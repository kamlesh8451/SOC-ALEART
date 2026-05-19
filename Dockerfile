# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
# Copy sub-package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# Copy source code
COPY . .

# Build both layers
RUN cd backend && npm run build
RUN cd frontend && npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built assets
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json ./package.json

# Environment setup
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run the backend (which serves the frontend)
CMD ["node", "backend/dist/server.cjs"]
