# ---------- Build stage ----------
FROM node:24-alpine3.21 AS builder

# Add build tools *only* here
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

# Install dependencies with deterministic lock file
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci

# Copy TS source & build it
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM node:24-alpine3.21

WORKDIR /usr/src/app

# Copy only compiled app and prod node_modules
COPY --from=builder /usr/src/app/dist          ./dist
COPY --from=builder /usr/src/app/node_modules  ./node_modules
COPY package*.json ./

# Remove dev dependencies (they shouldn’t exist, but belt-and-braces)
RUN npm prune --omit=dev

EXPOSE 3000

ENTRYPOINT ["sh", "-c", "npm run migration:run && node dist/index.js"]
