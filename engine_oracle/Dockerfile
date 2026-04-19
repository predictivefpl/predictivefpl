FROM python:3.11-slim
WORKDIR /app

# Install system dependencies including OpenMP for LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends     libgomp1     gcc     g++     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["sh", "-c", "python -m uvicorn api.server:app --host 0.0.0.0 --port ${PORT:-8001}"]
