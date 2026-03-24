# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Caddy serves the built SPA + proxies the Django API
FROM caddy:2-alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
