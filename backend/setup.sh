

# get script dir
FILEDIR="$(cd "$(dirname "$0")" && pwd)"
# get script name
FILENAME=$(basename "$0")

# create .venv if not existent
PYTHON_COMMAND="python3"
# if python3 exists, use python3, if python exists then use python, otherwise exit
if command -v python3 &> /dev/null; then
    PYTHON_COMMAND="python3"
elif command -v python &> /dev/null; then
    PYTHON_COMMAND="python"
else
    echo "Python 3 is not installed. Please install Python 3."
    exit 1
fi

# store location to .venv
VENV_LOCATION=${FILEDIR}/../.venv
# store location to requirements.txt
REQUIREMENTS_LOCATION=${FILEDIR}/../requirements.txt

echo "Running $FILENAME in $FILEDIR"

# ------------------------------------------------------ #
# setup env
# ------------------------------------------------------ #

# create ../.venv if not existent
if [ ! -d "$VENV_LOCATION" ]; then
    echo "Creating virtual environment"
    $PYTHON_COMMAND -m venv "$VENV_LOCATION"
fi

# activate .venv
source "$VENV_LOCATION/bin/activate"

# -------------------------------------------------------- #
# install requirements
# -------------------------------------------------------- #

pip install -r $REQUIREMENTS_LOCATION

# check for errors from prev command
if [ $? -ne 0 ]; then
    echo "Error installing requirements"
    exit 1
fi

# -------------------------------------------------------- #
# run server
# -------------------------------------------------------- #

# check if .env exists
if [ ! -f "../.env" ]; then
    # error
    echo "Error: .env file does not exist"
    exit 1
fi
# check if .env file is readable
if [ ! -r "../.env" ]; then
    echo "Error: .env file is not readable"
    exit 1
fi

# ----------------------------------------------------- #
# load env variables from .env
# ----------------------------------------------------- #

# load env variables from .env file
export $(grep -v '^#' ../.env | xargs)

# ---------------------------------------------------- #
# create database
# ---------------------------------------------------- #

MONGODB_IMAGE="mongodb/mongodb-community-server"
MONGODB_IMAGE_TAG="8.0.4-ubuntu2204"
MONGODB_CONTAINER_NAME="stt_whisper_cpp-mongodb"

MONGODB_DB_FOLDER="$FILEDIR/data/db"

# check if has mongodb - if no pull
DOCKER_IMAGES=$(docker images)
docker pull "$MONGODB_IMAGE:$MONGODB_IMAGE_TAG"

# check if has mongodb container - if no create, if yes start
# also setup default user and password in mongodb container
DOCKER_CONTAINERS=$(docker container ls -a)
if [[ ! "$DOCKER_CONTAINERS" == *"$MONGODB_CONTAINER_NAME"* ]]; then
    echo "Creating MongoDB container"

    docker run -d --name "$MONGODB_CONTAINER_NAME" -v "$MONGODB_DB_FOLDER:/data/db"  -e MONGO_INITDB_ROOT_USERNAME="$MONGODB_CONTAINER_ADMIN_USER" -e MONGO_INITDB_ROOT_PASSWORD="$MONGODB_CONTAINER_ADMIN_PASSWORD" -e MONGO_INITDB_DATABASE="$MONGODB_DATABASE" -p 27017:27017 "$MONGODB_IMAGE:$MONGODB_IMAGE_TAG" 
    docker exec "$MONGODB_CONTAINER_NAME" mongosh \
      --username "$MONGODB_CONTAINER_ADMIN_USER" \
      --password "$MONGODB_CONTAINER_ADMIN_PASSWORD" \
      --authenticationDatabase "$MONGODB_CONTAINER_ADMIN_AUTH_SOURCE" \
      --eval "db.getSiblingDB('$MONGODB_DATABASE').createUser({user: '$MONGODB_USERNAME', pwd: '$MONGODB_PASSWORD', roles: [{role: 'readWrite', db: '$MONGODB_DATABASE'}]})"

else
    echo "Starting MongoDB container"
    docker start "$MONGODB_CONTAINER_NAME"
fi



# ---------------------------------------------------- #
# start server
echo "Starting server"
echo "Running $FILEDIR/main.py in $FILEDIR"

$PYTHON_COMMAND $FILEDIR/main.py

# check if error or interrupt
if [ $? -ne 0 ]; then
    echo "Error running server"
    exit 1
fi
