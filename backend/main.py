import flask_cors
from flask import Flask
from flask_socketio import SocketIO, emit

from backend import socketio_instance

from api.stt import stt_bp
from api.streaming import streaming_bp

import os
import dotenv

# ---------------------------------------------------------------------------- #

# load env
dotenv.load_dotenv()

# --------------------------------------------------------------------------- #
# Flask app
# --------------------------------------------------------------------------- #

NAME = "Speech-To-Text by Peter"

app = Flask(__name__, static_folder="static")
app.config["JSONIFY_PRETTYPRINT_REGULAR"] = False
app.config["JSONIFY_MIMETYPE"] = "application/json"
app.config["CORS_HEADERS"] = "Content-Type"
flask_cors.CORS(app, resources={r"/*": {"origins": "*"}})

# --------------------------------------------------------------------------- #
# Register blueprints + objects
# --------------------------------------------------------------------------- #

with app.app_context():
    # register blue prints
    app.register_blueprint(stt_bp, url_prefix="/stt")
    app.register_blueprint(streaming_bp, url_prefix="/streaming")

    # -------------------------------------------------- #
    # register custom objects
    # -------------------------------------------------- #

    # general info
    app.config["NAME"] = NAME
    app.config["VERSION"] = "0.0.1"
    app.config["DESCRIPTION"] = "Speech-To-Text API by Peter"
    app.config["AUTHOR"] = "peterzhang2427@gmail.com"

    # architecutre info
    app.config["BASE_ARCHITECTURE"] = "whisper.cpp"
    app.config["BASE_ARCHITECTURE_GITHUB"] = "https://github.com/ggml-org/whisper.cpp"

    # model info
    app.config["LOADED_MODELS"] = {}
    app.config["SUPPORTED_MODELS"] = [
        "tiny",
        "base",
        "base.en",  # 100% sure this one exists
        "small",
        "medium",
        "medium.en",
        "large-v1",
        "large-v2",  # idk why you'd want to run this one though
    ]

    app.config["WHISPER_LOGS"] = True
    app.config["WHISPER_LOGS_DIR"] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "logs"
    )
    app.config["WHISPER_MODELS_DIR"] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "assets", "models"
    )

    app.config["AUDIO_CACHE_DIR"] = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "static", "audio"
    )

    app.config["MODEL_PATH_MAP"] = {
        # "tiny": "tiny.bin",
        # "base": "base.bin",
        "base.en": os.path.join(app.config["WHISPER_MODELS_DIR"], "ggml-base.en.bin"),
        # "small": os.path.join(app.config["WHISPER_MODELS_DIR"], "ggml-small.bin"),
        # "medium": os.path.join(app.config["WHISPER_MODELS_DIR"], "ggml-medium.bin"),
        # "medium.en": os.path.join(
        #     app.config["WHISPER_MODELS_DIR"], "ggml-medium.en.bin"
        # ),
        # "large-v1": os.path.join(
        #     app.config["WHISPER_MODELS_DIR"], "ggml-large-v1.bin"
        # ),
        # "large-v2": os.path.join(
        #     app.config["WHISPER_MODELS_DIR"], "ggml-large-v2.bin"
        # )
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #


@app.route("/", methods=["GET"])
def index():
    """Index route."""
    return "You're at the index source"


@app.route("/hello_world")
def hello_world():
    """Hello world route."""
    return "You're at hello world"


# ----------------------------------------------------------------------------- #
# Run App
# ----------------------------------------------------------------------------- #

if __name__ == "__main__":
    socketio_instance.init_app(app)
    socketio_instance.run(app, host="0.0.0.0", port=3000, debug=True)
