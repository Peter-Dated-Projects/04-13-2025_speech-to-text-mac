

# get script dir
FILEDIR=$(dirname "$0")
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

# create .venv if not existent
if [ ! -d VENV_LOCATION ]; then
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
if [ ! -f ".env" ]; then
    # error
    echo "Error: .env file does not exist"
    exit 1
fi
# check if .env file is readable
if [ ! -r ".env" ]; then
    echo "Error: .env file is not readable"
    exit 1
fi

# ---------------------------------------------------- #
# create database

mongod --config mongodb.conf --dbpath "$FILEDIR/data/db" --fork

# ---------------------------------------------------- #
# start server
echo "Starting server"
echo "Running $FILEDIR/main.py in $FILEDIR"

$PYTHON_COMMAND $FILEDIR/main.py
