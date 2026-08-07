FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y wget unzip && rm -rf /var/lib/apt/lists/*

# Install python dependencies
RUN pip install --no-cache-dir vosk websockets

# Download and bake in the small model
WORKDIR /opt
RUN wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip -q vosk-model-small-en-us-0.15.zip && \
    mv vosk-model-small-en-us-0.15 vosk-model-en && \
    rm vosk-model-small-en-us-0.15.zip

# Add the server script
WORKDIR /app
COPY asr_server.py .

EXPOSE 2700

# Start the server with the baked-in model
CMD ["python3", "asr_server.py", "/opt/vosk-model-en"]
