#!/bin/bash

# Script to run both backend and frontend servers simultaneously

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting KendraBindu AI...${NC}\n"

# Activate virtual environment
source "$DIR/.venv/bin/activate"

# Start backend server
echo -e "${GREEN}Starting Backend (FastAPI)...${NC}"
cd "$DIR/backend"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend server
echo -e "${GREEN}Starting Frontend (Next.js)...${NC}"
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}Services started:${NC}"
echo "Backend:  http://0.0.0.0:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}\n"

# Function to clean up on exit
cleanup() {
  echo -e "\n${BLUE}Stopping services...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  echo -e "${GREEN}Services stopped${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for background processes
wait
