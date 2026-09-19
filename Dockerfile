# ==========================================
# Multi-Stage Build: LivePoll Web Service
# ==========================================

# Step 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Step 2: Build Go Backend
FROM golang:alpine AS backend-builder
WORKDIR /app/backend
ENV GOTOOLCHAIN=auto
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./cmd/server

# Step 3: Production Minimal Runner
FROM alpine:3.20
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=backend-builder /app/server /app/server
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /frontend/dist

ENV PORT=8080
ENV GIN_MODE=release

EXPOSE 8080

CMD ["/app/server"]
