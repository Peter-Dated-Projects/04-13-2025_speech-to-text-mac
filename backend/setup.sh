

# get script dir
FILEDIR=$(dirname "$0")
# get script name
FILENAME=$(basename "$0")


echo "Running $FILENAME in $FILEDIR"

# ------------------------------------------------------ #
# setup env
# ------------------------------------------------------ #

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

# create .venv if not existent
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment"
    $PYTHON_COMMAND -m venv .venv
fi

# activate .venv
source "$FILEDIR/../.venv/bin/activate"

# -------------------------------------------------------- #
# install requirements
# -------------------------------------------------------- #

# pip install -r requirements.txt

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
    echo "Creating .env file"
    # write a lot of data into .env
    cat << EOF > .env       # TODO - change this
# .env file for backend

PORT=5000

DB_URL=sqlite:///./test.db
DB_NAME=test.db
DB_USER=admin
DB_PASSWORD=admin
DB_HOST=localhost
DB_PORT=5432
EOF
fi

# check if .env file is readable
if [ ! -r ".env" ]; then
    echo "Error: .env file is not readable"
    exit 1
fi

# ---------------------------------------------------- #
# create database

mongod --dbpath "$FILEDIR/data/db" &

# add other monogodb settings to run command

# ---------------------------------------------------- #
# start server
echo "Starting server"
echo "Running $FILEDIR/main.py in $FILEDIR"

$PYTHON_COMMAND $FILEDIR/main.py
