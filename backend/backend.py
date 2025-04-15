from flask_socketio import SocketIO


_AUDIO_BUFFERS = {}

CACHE_STREAMING_KEY = "streaming_key"
CACHE_AUDIO_DATA = "audio_data"
CACHE_FILE_PATH = "file_path"


socketio_instance = SocketIO(cors_allowed_origins="*")
