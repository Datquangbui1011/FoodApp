FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_BREAK_SYSTEM_PACKAGES=1

# System deps: ffmpeg + Python
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

# EasyOCR + PyTorch CPU (~1.5 GB, cached in image)
RUN pip3 install easyocr

# Pre-download EasyOCR model into image — eliminates cold-start model fetch
RUN python3 -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

# TypeScript runtime
RUN npm install -g ts-node typescript

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD ["ts-node", "src/server.ts"]
