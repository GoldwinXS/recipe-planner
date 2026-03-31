FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/base.txt

FROM base AS development
RUN pip install --no-cache-dir -r requirements/development.txt
COPY . .

FROM base AS production
RUN pip install --no-cache-dir -r requirements/production.txt
COPY . .
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--graceful-timeout", "30"]
