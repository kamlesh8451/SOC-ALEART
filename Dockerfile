# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN cd backend && npm install
RUN cd frontend && npm install

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npm run build
RUN cd frontend && npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "dist/server.cjs"]
