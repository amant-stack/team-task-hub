# Railway Dockerfile for Baki Task (TanStack Start + Cloudflare Workers)
FROM node:22-slim AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:22-slim AS production

WORKDIR /app

# Copy built output and deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/wrangler.jsonc ./

# Railway provides PORT env var dynamically
ENV PORT=3000

# Use wrangler to serve the Workers build locally
# Execute as a shell command so ${PORT} is evaluated correctly
CMD npx wrangler dev dist/server/index.js --config dist/server/wrangler.json --port ${PORT} --ip 0.0.0.0
