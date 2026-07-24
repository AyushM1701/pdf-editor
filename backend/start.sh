#!/bin/bash
echo "Starting AI background worker..."
arq app.worker.WorkerSettings &

echo "Starting FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
