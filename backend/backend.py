from flask_socketio import SocketIO
from pymongo import MongoClient

import os


# ---------------------------------------------------------------------------- #
# constants
# ---------------------------------------------------------------------------- #

CACHE_STREAMING_KEY = "streaming_key"
CACHE_AUDIO_DATA = "audio_data"
CACHE_FILE_PATH = "file_path"
CACHE_FILE_URL = "file_url"


# ---------------------------------------------------------------------------- #
# classes
# ---------------------------------------------------------------------------- #


# socketio factory
class SocketIOInstance:
    __INSTANCE = None

    @staticmethod
    def get_instance():
        if not SocketIOInstance.__INSTANCE:
            SocketIOInstance.__INSTANCE = SocketIO(cors_allowed_origins="*")
        return SocketIOInstance.__INSTANCE


# audio buffers factory
class AudioBuffersInstance:
    __INSTANCE = None

    @staticmethod
    def get_instance():
        if not AudioBuffersInstance.__INSTANCE:
            AudioBuffersInstance.__INSTANCE = {}
        return AudioBuffersInstance.__INSTANCE


# mongodb factory
class MongoDBInstance:
    __INSTANCE = None

    @staticmethod
    def get_instance():
        if not MongoDBInstance.__INSTANCE:
            mongo_uri = os.getenv("MONGODB_URI")
            if not mongo_uri:
                raise ValueError("MONGODB_URI environment variable not set")

            # # print data
            # print(f"Username: {os.getenv('MONGODB_USERNAME')}")
            # print(f"Password: {os.getenv('MONGODB_PASSWORD')}")
            # print(f"Auth Source: {os.getenv('MONGODB_AUTH_SOURCE', 'admin')}")

            _client = MongoClient(
                mongo_uri,
                username=os.getenv("MONGODB_USERNAME"),
                password=os.getenv("MONGODB_PASSWORD"),
                authSource=os.getenv("MONGODB_AUTH_SOURCE", "admin"),
                authMechanism=os.getenv("MONGODB_AUTH_MECHANISM", "SCRAM-SHA-256"),
            )
            MongoDBInstance.__INSTANCE = _client
        return MongoDBInstance.__INSTANCE

    @staticmethod
    def get_database():
        """Get the default database."""
        client = MongoDBInstance.get_instance().get_default_database()
        if client is None:
            raise ValueError("MONGODB_URI environment variable not set")
        return client

    @staticmethod
    def get_collection(name: str):
        """Get the default collection."""
        client = MongoDBInstance.get_instance().get_default_database()
        # check if name is valid collection
        if name not in client.list_collection_names():
            raise ValueError(f"Collection {name} does not exist")
        # check if client is valid
        if client is None:
            raise ValueError("MONGODB_DATABASE environment variable not set")
        return client[name]
