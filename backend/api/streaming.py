from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO, emit

from flask import current_app as app
from backend import (
    socketio_instance,
    _AUDIO_BUFFERS,
    CACHE_STREAMING_KEY,
    CACHE_AUDIO_DATA,
    CACHE_FILE_PATH,
)

import os
import ffmpeg

from typing import Optional, Union, List, Dict, Any


# --------------------------------------------------------------------------- #
# blueprint
# --------------------------------------------------------------------------- #

streaming_bp = Blueprint("streaming_bp", __name__)


# --------------------------------------------------------------------------- #
# verification functions
# --------------------------------------------------------------------------- #


def is_valid_streaming_key(key: str) -> bool:
    """Check if the streaming key is valid."""
    # Check if the key exists in the _AUDIO_BUFFERS
    return key in _AUDIO_BUFFERS


def is_audio_buffer_empty(key: str) -> bool:
    """Check if the audio buffer is empty."""
    # Check if the key exists and if its buffer is empty
    return is_valid_streaming_key(key) and len(_AUDIO_BUFFERS[key]) == 0


def process_audio(key: str) -> bool:
    """Process the audio buffer."""
    # Check if the key exists and process the audio
    if not is_valid_streaming_key(key):
        return False

    audio_chunks = _AUDIO_BUFFERS[key][CACHE_AUDIO_DATA]
    # Combine the chunks into a single blob
    audio_blob = b"".join(audio_chunks)
    _raw_path = os.path.join(app.config["AUDIO_CACHE_DIR"], f"recording_{key}.webm")

    print(f"This is the streaming key: {_AUDIO_BUFFERS[key][CACHE_STREAMING_KEY]}")
    print(_AUDIO_BUFFERS[key][CACHE_FILE_PATH])
    print(f"Audio buffer length: {len(audio_blob)}")

    # save the audio file as a webm file
    try:
        with open(_raw_path, "wb") as f:
            f.write(audio_blob)

        print("Saved audio blob to raw temporary file")

        _temp_file = os.path.join(app.config["AUDIO_CACHE_DIR"], f"temp_{key}.wav")
        _final_file = _AUDIO_BUFFERS[key][CACHE_FILE_PATH]
        # ffmpeg to save file as proper format
        ffmpeg.input(_raw_path).output(
            _final_file, ar=16000, ac=1, acodec="pcm_s16le"
        ).run(quiet=False, overwrite_output=True)
        print("Saved audio data to wav file: ", _AUDIO_BUFFERS[key][CACHE_FILE_PATH])

    except Exception as e:
        print(f"Error processing audio: {e}")
        return False

    print(f"Audio processed and saved to {_AUDIO_BUFFERS[key][CACHE_FILE_PATH]}")

    # reset audio data
    _AUDIO_BUFFERS[key].popitem()

    return True


# --------------------------------------------------------------------------- #
# routes
# --------------------------------------------------------------------------- #


@socketio_instance.on("connect", namespace="/streaming")
def handle_connect():
    print("Client connected", request.sid)
    sid = request.sid

    _AUDIO_BUFFERS[sid] = {
        CACHE_STREAMING_KEY: sid,
        CACHE_FILE_PATH: os.path.join(app.config["AUDIO_CACHE_DIR"], f"{sid}.wav"),
        CACHE_AUDIO_DATA: [],
    }

    # check if valid streaming key
    if not is_valid_streaming_key(sid):
        emit("error", {"message": "Invalid streaming key"})
        return

    emit("response", {"message": "Connected to server"})


@socketio_instance.on("stop_recording", namespace="/streaming")
def handle_stop_recording():
    sid = request.sid

    # check if valid streaming key
    if not is_valid_streaming_key(sid):
        emit("error", {"message": "Invalid streaming key"})
        return

    # return the audio file path
    print("Emitting file path: ", _AUDIO_BUFFERS[sid][CACHE_FILE_PATH])
    file_path = _AUDIO_BUFFERS[sid][CACHE_FILE_PATH]
    # Construct a public URL for the audio file.
    base_url = app.config.get("AUDIO_BASE_URL", "http://localhost:3000/static/audio")
    file_url = f"{base_url}/{os.path.basename(file_path)}"

    print(file_url)
    emit(
        "result_file_path",
        {
            "streaming_id": sid,
            "message": "Disconnected from server",
            "file_url": file_url,
        },
    )


@socketio_instance.on("disconnect", namespace="/streaming")
def handle_disconnect():
    print("Client disconnected", request.sid)
    sid = request.sid

    # check if valid streaming key
    if not is_valid_streaming_key(sid):
        emit("error", {"message": "Invalid streaming key"})
        return

    # process + clean up buffered audio data
    if not process_audio(sid):
        emit("error", {"message": "Failed to process audio"})

    print(f"Saved recording for client {sid}")


@socketio_instance.on("audio_chunk", namespace="/streaming")
def handle_audio_chunk(data):
    """Handle incoming audio chunk."""
    sid = request.sid
    # check if valid streaming id
    if not sid:
        emit("error", {"message": "Invalid streaming key"})

    # check if valid streaming key
    if not is_valid_streaming_key(sid):
        emit("error", {"message": "Invalid streaming key"}, namespace="/streaming")
        return

    _chunk = data["chunk"]
    print("Received chunk: length = ", len(_chunk))

    # Append the received audio data to the buffer
    _AUDIO_BUFFERS[sid][CACHE_AUDIO_DATA].append(_chunk)

    # Optionally, send back a response
    emit("response", {"message": "received chunk"}, namespace="/streaming")


@streaming_bp.route("/force_stop", methods=["POST"])
def streaming_finalize_audio():
    """Force stop audio streaming."""
    _sid = request.session_id
    # check if valid streaming key
    if not is_valid_streaming_key(_sid):
        return jsonify({"error": "Invalid streaming key"}), 400

    # check if audio buffer is empty
    if is_audio_buffer_empty(_sid):
        return jsonify({"error": "Audio buffer is empty"}), 400

    # process + clean up buffered audio data
    if not process_audio(_sid):
        return jsonify({"error": "Failed to process audio"}), 500

    return jsonify({"message": "Audio processing complete"}), 200
