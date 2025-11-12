# Start Backend:

cd backend

python -m venv venv # DO THIS ONLY FIRST TIME

source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements.txt

uvicorn main:app --reload 

# Install Node.js to your pc (MacOS):

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

\. "$HOME/.nvm/nvm.sh"

nvm install 24

node -v # Should print "v24.11.1".

npm -v # Should print "11.6.2".

# Install Node.js to your pc (Windows):

powershell -c "irm https://community.chocolatey.org/install.ps1|iex"

choco install nodejs --version="24.11.1"

node -v # Should print "v24.11.1".

npm -v # Should print "11.6.2".


# Start Frontend:

cd frontend

npm install # ONLY FIRST TIME

npm run dev
