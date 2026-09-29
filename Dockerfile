# Stage 1: Build stage
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source files
COPY . .

# Build-time environment variables for Vite
ARG VITE_N8N_WEBHOOK_URL=https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api
ARG VITE_N8N_IMPORT_WEBHOOK_URL=https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/import
ENV VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL
ENV VITE_N8N_IMPORT_WEBHOOK_URL=$VITE_N8N_IMPORT_WEBHOOK_URL

# Build the application
RUN npm run build

# Stage 2: Production stage using Nginx
FROM nginx:alpine AS production-stage

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose container port 80 (Traefik proxies to port 80 inside the container)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
