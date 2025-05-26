from flask import Blueprint, jsonify, request
from flask import current_app as app

import os

from backend import MongoDBInstance
from typing import Optional, Union, List, Dict, Any
from bson import json_util, ObjectId, Binary
import json

from models import conversation, user, segment


from mongoengine import NotUniqueError

# --------------------------------------------------------------------------- #
# blueprint
# -------------------------------------------------------------------------- #

storage_bp = Blueprint("storage_bp", __name__)


# --------------------------------------------------------------------------- #
# utility functions
# --------------------------------------------------------------------------- #


def get_db_objects(
    filter: dict, collection_name: str
) -> Optional[List[Dict[str, Any]]]:
    """
    Get objects from the mongodb server and convert to JSON-serializable format

    Args:
        filter (dict): filter to apply to the query
        collection_name (str): name of the collection to query

    Returns:
        list: list of objects with serializable types
    """
    client = MongoDBInstance.get_database()
    if client is None:
        return None

    # perform ensured check
    if not ensured_enpoint(collection_name):
        print("Created new collection")

    collection = client[collection_name]
    if collection is None:
        return None

    objects = list(collection.find(filter))

    # Convert BSON to JSON-serializable format
    return json.loads(json_util.dumps(objects))


def ensured_enpoint(collection_name: str):
    """

    Makes sure that a database andn colelction exist in the mongodb server
    Args:
        database_name (str): name of the database
        collection_name (str): name of the collection

    Returns:
        bool: True if the database and collection exist, False otherwise
    """

    client = MongoDBInstance.get_database()
    if client is None:
        return False

    # check if collection exists
    print(client)
    if collection_name not in client.list_collection_names():
        # create
        client.create_collection(collection_name)
        return False

    return True


# --------------------------------------------------------------------------- #
# storage functions
# --------------------------------------------------------------------------- #


@storage_bp.route("/status", methods=["GET"])
def status():
    """Check the status of the mongodb server."""
    try:
        client = MongoDBInstance()()
        client.admin.command("ping")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        app.logger.error(f"MongoDB connection error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@storage_bp.route("/upload", methods=["POST"])
def upload():
    """Upload data to the mongodb server."""
    # get query data
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # check for collection name
    collection_name = data.get("collection")
    if not collection_name:
        return (
            jsonify({"status": "error", "message": "No collection name provided"}),
            400,
        )

    # check for object data
    object_data = data.get("object")
    if not object_data:
        return jsonify({"status": "error", "message": "No object data provided"}), 400

    # create collection if it doesnt exist
    client = MongoDBInstance.get_database()

    if client is None:
        return jsonify({"status": "error", "message": "No mongodb client found"}), 500

    if collection_name not in client.list_collection_names():
        client.create_collection(collection_name)

    # insert object into collection - if object is not None
    if object_data:
        collection = client[collection_name]

        print(object_data)

        if isinstance(object_data, list):
            # insert many
            result = collection.insert_many(object_data)
        else:
            # insert one
            result = collection.insert_one(object_data)

        if not result:
            return (
                jsonify({"status": "error", "message": "Failed to insert object"}),
                500,
            )

    return jsonify({"status": "ok"}), 200


@storage_bp.route("/delete", methods=["DELETE"])
def delete():
    """
    Delete all data from the mongodb server

    Sample Input:

    {
        "type": "object",
        "collection": "test",
        "object": "test",
        "filter": {
            "name": "test"
        }
    }


    """
    # get query data
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # get the mongodb client
    client = MongoDBInstance.get_database()
    if client is None:
        return jsonify({"status": "error", "message": "No mongodb client found"}), 500

    # check what we are deleting
    target_type = data.get("type")
    if not target_type:
        return (
            jsonify({"status": "error", "message": "No target type provided"}),
            400,
        )

    # retrieve collection name + filter criteria
    collection_name = data.get("collection")
    filter_criteria = data.get("filter")

    if target_type == "collection":
        if not collection_name:
            return (
                jsonify({"status": "error", "message": "No collection name provided"}),
                400,
            )
        # delete collection
        client.drop_collection(collection_name)
    elif target_type == "object":
        # delete object
        if filter_criteria and not isinstance(filter_criteria, dict):
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Filter criteria must be a dictionary",
                    }
                ),
                400,
            )
        if not collection_name:
            return (
                jsonify({"status": "error", "message": "No collection name provided"}),
                400,
            )
        print(filter_criteria)

        # delete documents matching the filter directly
        result = client[collection_name].delete_many(
            filter_criteria if filter_criteria else {}
        )

        return (
            jsonify(
                {
                    "status": "ok",
                    "message": f"Deleted {result.deleted_count} objects",
                }
            ),
            200,
        )
    else:
        # invalid type
        return (
            jsonify({"status": "error", "message": "Invalid target type provided"}),
            400,
        )

    # temporary
    print(data)

    return jsonify({"status": "ok"}), 200


@storage_bp.route("/get_objects", methods=["POST"])
def get_objects():
    """Get object from the mongodb server."""
    # get query data
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # check for collection name
    collection_name = data.get("collection")
    if not collection_name:
        return (
            jsonify({"status": "error", "message": "No collection name provided"}),
            400,
        )

    # Make filter optional by providing a default empty dict
    filters = data.get("filter", {})

    # get the mongodb client
    client = MongoDBInstance.get_database()
    if client is None:
        return jsonify({"status": "error", "message": "No mongodb client found"}), 500

    # get the object from the collection
    try:
        results = get_db_objects(filters, collection_name)
        print(results)

        if results is None:
            return (
                jsonify({"status": "error", "message": "Failed to retrieve objects"}),
                500,
            )

        return jsonify({"status": "ok", "objects": results}), 200
    except Exception as e:
        app.logger.error(f"Error retrieving objects: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@storage_bp.route("/create_conversation", methods=["POST"])
def create_conversation():
    """
    Create a new conversation in the database

    {
        "data": {
            "title": {name of the conversation},
            "description": {description of the conversation},

            "audio_data": {null or binary data},
            "audio_duration": {duration of the audio in seconds},
            "compressed": {boolean indicating if the audio is compressed},
            "segment_ids": [{list of segment ids} | or null],

            "created_at": {timestamp of creation},
            "updated_at": {timestamp of last update},

            "participants": [{list of user ids} | or null for now]
        }
    }

    ."""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # get the mongodb client
    client = MongoDBInstance.get_database()
    if client is None:
        return jsonify({"status": "error", "message": "No mongodb client found"}), 500

    # create collection if it doesn't exist
    collection_name = "conversations"
    if collection_name not in client.list_collection_names():
        client.create_collection(collection_name)

    # create a model instance of the conversation object
    _conversation_target = conversation.Conversation(
        title=data.get("title"),
        description=data.get("description"),
        audio_data=Binary(data.get("audio_data", b"")),
        audio_duration=data.get("audio_duration", 0.0),
        compressed=data.get("compressed", False),
        segment_ids=data.get("segment_ids", []),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        participants=data.get("participants", []),
    )

    # Convert conversation object to string representation with all stored data
    print(f"Conversation data: {json_util.dumps(_conversation_target.to_mongo())}")

    # return fail for now
    # return jsonify({"status": "error", "message": "Not implemented"}), 501

    # add an object into the conversation data
    result = _conversation_target.save()
    if not result:
        return (
            jsonify({"status": "error", "message": "Failed to create conversation"}),
            500,
        )

    return jsonify({"status": "ok", "id": str(result)}), 200


@storage_bp.route("/create_user", methods=["POST"])
def create_user():
    """
    Create a new user in the database

    {
        "data": {
            "first_name": {first name of the user},
            "last_name": {last name of the user},
            "email": {email of the user},
            "password": {password of the user},

            "address": {optional address of the user},

            "created_at": {timestamp of creation},
            "updated_at": {timestamp of last update},
            "is_active": {boolean indicating if the user is active}
        }
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # get the mongodb client
    client = MongoDBInstance.get_database()
    if client is None:
        return jsonify({"status": "error", "message": "No mongodb client found"}), 500

    # create collection if it doesn't exist
    collection_name = "users"
    if collection_name not in client.list_collection_names():
        client.create_collection(collection_name)

    # create a model instance of the user object
    _user_target = user.User(
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        email=data.get("email"),
        password=data.get("password"),
        address=data.get("address"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        is_active=data.get("is_active", True),
    )

    # Convert user object to string representation with all stored data
    print(f"User data: {json_util.dumps(_user_target.to_mongo())}")

    _user_exists = user.User.objects(email=_user_target.email).first()

    # add an object into the user data
    if _user_exists is not None:
        print("Found Duplicate User")

        # find existing object
        print(_user_exists)
        _json = json_util.loads(json_util.dumps(_user_exists.to_mongo()))
        print(_json)

        test_id = str(_json["_id"])
        print(test_id)
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Email already exists",
                    "code": "409",
                    "testid": test_id,
                }
            ),
            409,
        )

    result = _user_target.save()
    if not result:
        return (
            jsonify({"status": "error", "message": "Failed to create user"}),
            500,
        )

    return jsonify({"status": "ok", "id": str(result.id)}), 200
