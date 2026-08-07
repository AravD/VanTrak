# A small, production-ish container image for the FastAPI service.
FROM python:3.13-slim

# PYTHONUNBUFFERED: show logs immediately. PYTHONDONTWRITEBYTECODE: skip .pyc files.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install deps first so this layer stays cached unless requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the application code.
COPY app ./app

EXPOSE 8000

# 0.0.0.0 = listen on all interfaces so the port is reachable outside the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
