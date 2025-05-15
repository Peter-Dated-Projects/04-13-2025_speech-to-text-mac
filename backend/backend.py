from flask_socketio import SocketIO


CACHE_STREAMING_KEY = "streaming_key"
CACHE_AUDIO_DATA = "audio_data"
CACHE_FILE_PATH = "file_path"


class SocketIOInstance:
    __INSTANCE = None

    def __init__(self):
        pass

    def __call__(self):
        if not self.__INSTANCE:
            self.__INSTANCE = SocketIO(cors_allowed_origins="*")
        return self.__INSTANCE


class AudioBuffersInstance:
    __INSTANCE = None

    def __init__(self):
        pass

    def __call__(self):
        if not self.__INSTANCE:
            self.__INSTANCE = {}
        return self.__INSTANCE


# mongodb / database objects
