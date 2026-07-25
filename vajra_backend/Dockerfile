FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose port for AppSail
EXPOSE 8000

# Start FastAPI server. Catalyst AppSail assigns the real listen port via
# X_ZOHO_CATALYST_LISTEN_PORT at runtime (confirmed via the CLI's own local
# serve emulation source -- not $PORT, which Catalyst never actually sets).
# Exec-form CMD doesn't do shell variable expansion, so this runs through a
# shell for the variable to resolve, matching app-config.json's command.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $X_ZOHO_CATALYST_LISTEN_PORT"]
