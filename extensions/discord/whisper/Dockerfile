FROM python:3.9-bullseye

WORKDIR /app

COPY requirements.txt .
COPY app.py .

RUN pip install --progress-bar off --no-cache-dir -r requirements.txt

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
