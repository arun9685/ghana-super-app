# Multi-stage build: install + build in one stage, ship only the compiled
# output + prod dependencies in the final image (spec §7: Docker).
#
# `apk add openssl` in both stages: Alpine's base image doesn't ship an
# `openssl` binary, and Prisma's engine-detection step (run automatically
# by `prisma generate`) needs it to identify which OpenSSL version is
# present. Without it, detection silently fails and Prisma falls back to
# a legacy engine built for OpenSSL 1.1, which modern Alpine (OpenSSL 3.x)
# doesn't have — that's the
# `Error loading shared library libssl.so.1.1: No such file or directory`
# failure. Installing openssl lets detection succeed and the correct
# engine (matching schema.prisma's `linux-musl-openssl-3.0.x` binaryTarget)
# gets used instead.
# TODO(digest-pin): `node:20-alpine` is a moving tag — run
# infrastructure/docker/pin-base-images.sh on a machine with Docker +
# network access and replace both FROM lines below with
# `node:20-alpine@sha256:<digest>`; Dependabot then keeps it current.
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN echo "--- dist contents ---" && ls -la dist && \
    test -f dist/main.js || (echo "BUILD FAILED: dist/main.js was not produced by 'npm run build'" && exit 1)

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
RUN echo "--- runner dist contents ---" && ls -la dist && \
    test -f dist/main.js || (echo "COPY FAILED: dist/main.js missing in runner stage" && exit 1)

# Don't run the process as root inside the container.
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
