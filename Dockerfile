FROM node:24-bookworm-slim

WORKDIR /app

# better-sqlite3 is compiled during install, which needs Python and a C++ toolchain
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# The manifests go first, so the install layer is reused until a dependency changes
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci

COPY . .
RUN npm run build -w @lending/client

# One app serves both the API and the built client. The database lives on a mounted volume.
ENV PORT=8080 \
    DB_PATH=/data/lending.db \
    CLIENT_DIR=/app/apps/client/dist

WORKDIR /app/apps/server
EXPOSE 8080
CMD ["../../node_modules/.bin/tsx", "src/index.ts"]
