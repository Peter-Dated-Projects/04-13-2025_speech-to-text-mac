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

    def run(self):
        """Thread's main function - captures audio continuously"""
        instance = pyaudio.PyAudio()
        stream = instance.open(
            format=pyaudio.paInt16,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
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

    def get_audio_data(self):
        """Get all currently available audio data"""
        data = []
        while not self.audio_queue.empty():
            data.append(self.audio_queue.get())
        return data


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
    whisper_instance: WhisperModel, filename: str, request_id: int
) -> None:
    """Request transcription from the server."""
    # Wait until it's our turn
    while ResultsContainer.NEXT_REQUEST_ID != request_id:
        while ResultsContainer.CORE_BUSY:
            time.sleep(0.1)
        break
    ResultsContainer.CORE_BUSY = True
    ResultsContainer.NEXT_REQUEST_ID += 1

    # Request transcription
    future = ResultsContainer.THREAD_POOL_INSTANCE.submit(
        _transcribe_audio, whisper_instance, filename
    )
    future.add_done_callback(partial(_request_callback, filename=filename))


def _transcribe_audio(
    whisper_instance: WhisperModel,
    filename: str = None,
) -> List[Tuple[int, int, str]]:
    """Handle audio transcription."""
    if not filename:
        # Get audio data with thread safety
        with ResultsContainer.lock:
            audio_data_cache = ResultsContainer.AUDIO_DATA_CACHE.copy()

        _audio_transformed = np.frombuffer(b"".join(audio_data_cache), dtype=np.int16)
        _audio_transformed = _audio_transformed.astype(np.float32) / 32768.0

        # Handle audio transcription
        _segments = whisper_instance.transcribe(_audio_transformed)
    else:
        # Handle audio transcription from file
        _segments = whisper_instance.transcribe(filename)

    # Return segments
    return [[s.t0, s.t1, s.text] for s in _segments]


def _request_callback(future: Any, filename: str) -> None:
    """Callback function for handling transcription requests."""
    result = future.result()
    ResultsContainer.TRANSCRIPTION_CACHE = [r for r in result]
    # Mark core as free
    ResultsContainer.CORE_BUSY = False


# ------------------------------------------------------------ #
# Main application
# ------------------------------------------------------------ #

if __name__ == "__main__":
    whisper_instance = WhisperModel(
        model="assets/models/ggml-small.en.bin",
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
        while time.time() - _ct < 30:
            # Request transcription
            _request_transcription(
                whisper_instance,
                filename=None,
                request_id=ResultsContainer.REQUEST_COUNTER,
            )
            ResultsContainer.REQUEST_COUNTER += 1

            # Display transcription
            _transcription = "\t".join(
                [r[2] for r in ResultsContainer.TRANSCRIPTION_CACHE]
            )
            print(_transcription, end="\n\n")

            time.sleep(0.2)
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
