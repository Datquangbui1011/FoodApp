#!/bin/sh
# Start OCR server in background (model loads while Node starts up)
python3 /app/ocr_server.py &
# Start Express server as main process
exec ts-node src/server.ts
