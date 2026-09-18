# Multi-stage build: compile the Vite app, then serve the static output
# with nginx. VITE_* variables are baked into the JS bundle at build
# time (that's how Vite works — there's no server-side env to read at
# runtime), so they're passed in as build args from docker-compose.yml,
# sourced from frontend/.env.
#
# Build context for this Dockerfile is the repo root (see
# docker-compose.yml) so it can reach both frontend/ and this same
# infrastructure/docker/ folder for the nginx config.
# TODO(digest-pin): see infrastructure/docker/pin-base-images.sh — same
# reasoning as backend.Dockerfile.
FROM node:26-alpine AS builder
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# TODO(digest-pin): see infrastructure/docker/pin-base-images.sh.
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY infrastructure/docker/nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
