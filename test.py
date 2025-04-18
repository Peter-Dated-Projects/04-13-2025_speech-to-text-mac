import ffmpeg
import pyaudio
import wave
import os
import time
import numpy as np
import threading

from concurrent.futures import ThreadPoolExecutor
from functools import partial
from queue import Queue
from typing import List, Tuple, Dict, Any

from pywhispercpp.model import Model as WhisperModel


# ------------------------------------------------------------ #
# threading functions
# ------------------------------------------------------------ #


class ResultsContainer:
    THREAD_POOL_INSTANCE = ThreadPoolExecutor(max_workers=1)
    CORE_BUSY = False
    NEXT_REQUEST_ID = 0

    # Thread-safe container for audio data and transcription results
    REQUEST_COUNTER = 0
    AUDIO_DATA_CACHE = []
    TRANSCRIPTION_CACHE = []

    # Add a lock for thread safety
    lock = threading.Lock()


class MicrophoneThread(threading.Thread):
    def __init__(self, sample_rate=16000, chunk_size=1024, channels=1):
        super().__init__()
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.channels = channels
        self.is_running = False
        self.audio_queue = Queue()

    @staticmethod
    def get_audio_blob_size(chunk_size: int, channels: int) -> int:
        """Get the size of the audio blob in bytes."""
        return chunk_size * channels * 2

    def run(self):
        """Thread's main function - captures audio continuously"""
        instance = pyaudio.PyAudio()

        _mic_choices = []
        _info = instance.get_host_api_info_by_index(0)
        for i in range(_info["deviceCount"]):
            device = instance.get_device_info_by_index(i)
            if device["maxInputChannels"] > 0:
                _mic_choices.append(device["name"])
                print(f"Device {i}: {device['name']}")
        print("Select a microphone device:")
        # selected_device = int(input("Enter device index: "))
        selected_device = 3  # default for standard mac input
        print(f"Selected device: {_mic_choices[selected_device]}")
        # Open the microphone stream
        stream = instance.open(
            format=pyaudio.paInt16,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            input_device_index=selected_device,
            frames_per_buffer=self.chunk_size,
        )

        self.is_running = True
        while self.is_running:
            try:
                audio_data = stream.read(self.chunk_size, exception_on_overflow=False)
                # Add to both the queue and the container with lock protection
                self.audio_queue.put(audio_data)

                with ResultsContainer.lock:
                    ResultsContainer.AUDIO_DATA_CACHE.append(audio_data)
            except Exception as e:
                print(f"Error capturing audio: {e}")
                break

        # Clean up
        stream.stop_stream()
        stream.close()
        instance.terminate()
        print("Microphone thread stopped")

    def stop(self):
        """Stop the recording thread"""
        self.is_running = False

    def get_audio_data(self) -> List[bytes]:
        """Get all currently available audio data"""
        data = []
        while not self.audio_queue.empty():
            data.append(self.audio_queue.get())
        # Clear the queue
        self.audio_queue.queue.clear()
        return data

    # --------------------------------------------------- #
    # audio math
    # --------------------------------------------------- #

    @staticmethod
    def get_index_from_time(
        audio_bytes: List[bytes], start_time_millis: int
    ) -> Tuple[int, int]:
        """Get the index of the audio data from a specific timestamp."""
        if not audio_bytes:
            return 0, 0

        # Calculate bytes per second
        _bps = calculate_bytes_per_second(sample_rate=16000, sample_width=2, channels=1)
        _global_start_position = int(start_time_millis * _bps / 1000)

        # find start index
        _counter = 0
        _index = 0
        for i in range(len(audio_bytes)):
            _counter += len(audio_bytes[i])
            _index = i
            if _counter >= _global_start_position:
                break

        # find bytestring index
        _counter -= len(audio_bytes[_index])
        _bytestring_index = _global_start_position - _counter

        return _index, _bytestring_index

    @staticmethod
    def get_audio_from_timestamp(
        audio_bytes: List[bytes], start_time_millis: int
    ) -> List[bytes]:
        """Get audio data from a specific timestamp."""
        if not audio_bytes:
            return []

        # calculate index + etc
        _index, _bytestring_index = MicrophoneThread.get_index_from_time(
            audio_bytes, start_time_millis
        )
        if _index >= len(audio_bytes):
            return []
        if _bytestring_index >= len(audio_bytes[_index]):
            return []

        _result = []
        # get starting bytes
        _result.append(audio_bytes[_index][_bytestring_index:])
        for i in range(_index + 1, len(audio_bytes)):
            _result.append(audio_bytes[i])

        return _result


def calculate_bytes_per_second(
    sample_rate: int, sample_width: int, channels: int
) -> float:
    bytes_per_second = sample_rate * sample_width * channels
    return bytes_per_second


# ------------------------------------------------------------ #
# transcription functions - mostly unchanged
# ------------------------------------------------------------ #


def _save_audio_to_file(audio_cache: List[bytes], filename: str) -> None:
    """Save audio data to a file."""
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"".join(audio_cache))


def _request_transcription(
    whisper_instance: WhisperModel,
    filename: str,
    request_id: int,
    segments_buffer: int = 50,
) -> None:
    """Request transcription from the server."""
    # Wait until it's our turn
    while ResultsContainer.NEXT_REQUEST_ID != request_id:
        while ResultsContainer.CORE_BUSY:
            time.sleep(0.1)
        break
    ResultsContainer.CORE_BUSY = True
    ResultsContainer.NEXT_REQUEST_ID += 1

    # always request from 2nd last segment.
    # if a new segment is created, then we simply update "2nd last" segment location
    # rinse and repeat
    # greater audio context improves the transcription, therefore we may want to increase
    # the length of this buffer

    _start_index = len(ResultsContainer.TRANSCRIPTION_CACHE) - segments_buffer - 1
    if _start_index < 0:
        _start_index = 0
    # go through existing segments and determine the valid start time
    _start_time_millis = 0
    with ResultsContainer.lock:
        if len(ResultsContainer.TRANSCRIPTION_CACHE) > 0:
            _start_time_millis = ResultsContainer.TRANSCRIPTION_CACHE[_start_index][0]

        # extract the audio we want to transcribe
        # extract a certain time window we want to transcribe
        _audio_cache = MicrophoneThread.get_audio_from_timestamp(
            ResultsContainer.AUDIO_DATA_CACHE, _start_time_millis
        )

    # chekc if audio is long enough
    _blobs_length = len(
        ResultsContainer.AUDIO_DATA_CACHE
    ) * MicrophoneThread.get_audio_blob_size(chunk_size=1024, channels=1)
    if (
        _blobs_length
        / calculate_bytes_per_second(sample_rate=16000, sample_width=2, channels=1)
        < 1
    ):
        return

    # Request transcription
    future = ResultsContainer.THREAD_POOL_INSTANCE.submit(
        _transcribe_audio, whisper_instance, filename, _audio_cache
    )
    future.add_done_callback(
        partial(
            _request_callback,
            filename=filename,
            segments_buffer=segments_buffer,
            start_time_millis=_start_time_millis,
        )
    )

    # # request one with full audio clip
    # future_full = ResultsContainer.THREAD_POOL_INSTANCE.submit(
    #     _transcribe_audio,
    #     whisper_instance,
    #     filename,
    #     ResultsContainer.AUDIO_DATA_CACHE,
    # )
    # future_full.add_done_callback(
    #     lambda future: print(
    #         "\t".join(
    #             [f"{seg[0]:<8} - {seg[1]:<8} | {seg[2]}" for seg in future.result()]
    #         )
    #     )
    # )


def _transcribe_audio(
    whisper_instance: WhisperModel,
    filename: str = None,
    audio_data: List[bytes] = None,
) -> List[Tuple[int, int, str]]:
    """Handle audio transcription."""
    if not filename:
        # Handle audio transcription from microphone
        if audio_data is None:
            raise ValueError("No audio data provided for transcription.")

        # format audio for whisper
        _audio_transformed = np.frombuffer(b"".join(audio_data), dtype=np.int16)
        _audio_transformed = _audio_transformed.astype(np.float32) / 32768.0

        # Handle audio transcription
        _segments = whisper_instance.transcribe(_audio_transformed, split_on_word=True)
    else:
        # Handle audio transcription from file
        _segments = whisper_instance.transcribe(filename)

    # Return segments
    return [[s.t0, s.t1, s.text] for s in _segments]


def _request_callback(
    future: Any,
    filename: str = None,
    segments_buffer: int = 50,
    start_time_millis: int = 0,
) -> None:
    """Callback function for handling transcription requests."""
    try:
        result = future.result()

        # Safety check - if no results, preserve existing transcription
        if not result:
            print(
                "Warning: Received empty transcription result, keeping previous content"
            )
            ResultsContainer.CORE_BUSY = False
            return  # Keep existing transcription

        with ResultsContainer.lock:
            # If cache is empty, just set it to the result
            if not ResultsContainer.TRANSCRIPTION_CACHE:
                ResultsContainer.TRANSCRIPTION_CACHE = result
                ResultsContainer.CORE_BUSY = False
                return

            # Update all time data in results
            for i in range(len(result)):
                result[i][0] += start_time_millis
                result[i][1] += start_time_millis

            # find newest timestamp from current cache
            _cache_newest_time_stamp = (
                ResultsContainer.TRANSCRIPTION_CACHE[-1][1]
                if ResultsContainer.TRANSCRIPTION_CACHE
                else 0
            )

            # # Log for debugging
            # print(
            #     "\nCurrent transcription segments:",
            #     len(ResultsContainer.TRANSCRIPTION_CACHE),
            # )
            # print("New result segments:", len(result))
            # print(f"Newest Timestamp: {_cache_newest_time_stamp}")
            # print(
            #     "Current:",
            #     "\t".join(r[2] for r in ResultsContainer.TRANSCRIPTION_CACHE),
            # )
            # print("Results:", "\t".join(r[2] for r in result))

            # Find index indicating start of new items
            _results_new_beyond_index = len(result)  # Default to end of list
            for i, segment in enumerate(result):
                if segment[0] > _cache_newest_time_stamp:
                    _results_new_beyond_index = i
                    break

            # SIMPLIFIED APPROACH: Instead of trying to merge segments in complex ways,
            # let's use a more straightforward approach based on timestamps

            # 1. Keep all segments in the cache that end before our new result starts
            keep_until_index = len(ResultsContainer.TRANSCRIPTION_CACHE)
            for i, segment in enumerate(ResultsContainer.TRANSCRIPTION_CACHE):
                # If segment ends after new result starts
                if segment[1] >= result[0][0]:
                    keep_until_index = i
                    break

            # 2. Keep these segments and add all new ones
            if keep_until_index > 0:
                ResultsContainer.TRANSCRIPTION_CACHE = (
                    ResultsContainer.TRANSCRIPTION_CACHE[:keep_until_index]
                )
            else:
                ResultsContainer.TRANSCRIPTION_CACHE = []

            # 3. Append new segments starting from the new_beyond_index
            for i in range(_results_new_beyond_index, len(result)):
                ResultsContainer.TRANSCRIPTION_CACHE.append(result[i])

    except Exception as e:
        # Log the error but don't crash
        print(f"Error in transcription callback: {e}")
    finally:
        # Always mark core as free to prevent deadlocks
        ResultsContainer.CORE_BUSY = False


# ------------------------------------------------------------ #
# Main application
# ------------------------------------------------------------ #

if __name__ == "__main__":
    whisper_instance = WhisperModel(
        model="assets/models/ggml-base.en.bin",
        redirect_whispercpp_logs_to="stdout",
    )

    ResultsContainer.REQUEST_COUNTER = 0
    ResultsContainer.NEXT_REQUEST_ID = 0

    # Create and start the microphone thread
    mic_thread = MicrophoneThread()
    mic_thread.daemon = True  # Thread will stop when main program exits
    mic_thread.start()

    print("Recording started in background thread...")
    print("\n\n")

    # Main application loop
    _ct = time.time()
    try:
        # wait for mic to turn on
        while not mic_thread.is_running:
            time.sleep(0.1)
        print("Recording started...")
        while time.time() - _ct < 90:

            with ResultsContainer.lock:
                # Get audio data from the microphone thread
                request_counter = ResultsContainer.REQUEST_COUNTER

            # Request transcription
            _request_transcription(
                whisper_instance, filename=None, request_id=request_counter
            )
            with ResultsContainer.lock:
                # Increment the request counter
                ResultsContainer.REQUEST_COUNTER += 1

                # Display transcription
                _transcription = "\t".join(
                    [r[2] for r in ResultsContainer.TRANSCRIPTION_CACHE]
                )
                print(_transcription, end="\n\n")

            time.sleep(0.5)
    except KeyboardInterrupt:
        print("Stopping...")
        pass

    print()

    # Stop the microphone thread
    mic_thread.stop()
    mic_thread.join()  # Wait for the thread to finish

    # Save final audio
    with ResultsContainer.lock:
        _save_audio_to_file(ResultsContainer.AUDIO_DATA_CACHE, filename="output.wav")

    # Reset
    ResultsContainer.AUDIO_DATA_CACHE.clear()
    ResultsContainer.TRANSCRIPTION_CACHE.clear()
