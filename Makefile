.PHONY: install dev dev-backend dev-frontend build clean help

help:
	@echo "KendraBindu AI - Development Commands"
	@echo "=================================="
	@echo "make install       - Install all dependencies"
	@echo "make dev           - Run both backend and frontend"
	@echo "make dev-backend   - Run backend only"
	@echo "make dev-frontend  - Run frontend only"
	@echo "make build         - Build frontend for production"
	@echo "make clean         - Clean all caches and builds"

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

dev:
	@echo "Starting both backend and frontend..."
	@bash run.sh

dev-backend:
	@echo "Starting backend on http://0.0.0.0:8000"
	bash -c 'source .venv/bin/activate && cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000'

dev-frontend:
	@echo "Starting frontend on http://localhost:3000"
	cd frontend && npm run dev

build:
	cd frontend && npm run build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/out frontend/.turbo build dist
