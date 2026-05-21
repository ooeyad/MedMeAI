FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_APP=app:create_app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        tesseract-ocr \
        tesseract-ocr-ara \
        tesseract-ocr-eng \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN useradd --create-home --shell /bin/bash medme && \
    mkdir -p /app/storage && chown -R medme:medme /app
USER medme

EXPOSE 5000
CMD ["flask", "run", "--host", "0.0.0.0", "--port", "5000"]
