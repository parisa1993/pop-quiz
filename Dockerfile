# Production image: one container serves the Angular app, the API and Socket.IO.
FROM node:24-slim

# Prisma's migration engine needs OpenSSL; CA certs for downloading engines/prebuilds.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Data (SQLite + uploaded pictures) lives on a mounted volume so it survives redeploys.
ENV NODE_ENV=production \
    DATABASE_URL=file:/data/pop-quiz.db \
    UPLOADS_DIR=/data/uploads

WORKDIR /app/backend
# Railway sets PORT; start:prod applies migrations, then starts the server.
CMD ["npm", "run", "start:prod"]
