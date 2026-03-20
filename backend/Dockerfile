FROM python:3.11-slim

WORKDIR /app

# Dependencias de sistema para OpenCV
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python (cache de layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render usa a variavel PORT automaticamente
ENV PORT=8080
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health')"

CMD uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1
