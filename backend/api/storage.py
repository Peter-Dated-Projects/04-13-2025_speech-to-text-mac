from flask import Blueprint, jsonify, request
from flask import current_app as app

import os

from backend import MongoDBInstance
from typing import Optional, Union, List, Dict, Any
from bson import json_util
import json

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
