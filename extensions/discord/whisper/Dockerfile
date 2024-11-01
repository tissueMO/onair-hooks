FROM python:3.9-bullseye

WORKDIR /app
RUN pip install -U "huggingface_hub[cli]" && \
    huggingface-cli download Systran/faster-whisper-medium --local-dir model

WORKDIR /app/src
COPY requirements.txt .
COPY app.py .

RUN pip install --progress-bar off --no-cache-dir -r requirements.txt

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
