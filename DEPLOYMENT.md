# EightBit WhatsApp Outreach - VPS Production Deployment Guide

This guide details how to deploy the **EightBit WhatsApp Outreach** frontend application to your production VPS using Docker, Docker Compose, Nginx, and Traefik.

---

## 🌐 Deployment Details

- **Production Domain**: `https://wamarketing.eightbitsolutions.com`
- **Backend n8n Webhook API**: `https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api`
- **Backend Import Webhook**: `https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/import`

---

## 📋 Prerequisites

Before deploying, verify that your VPS satisfies the following:
1. **Docker & Docker Compose** (v2+) installed.
2. **Traefik Reverse Proxy** is running on the VPS.
3. The Docker network `proxy` exists on the server.
   *(If not created yet, create it using: `docker network create proxy`)*

---

## 🚀 Quick Deployment Steps

### 1. SSH into your VPS
```bash
ssh user@your-vps-ip
```

### 2. Clone or pull the repository
```bash
cd /opt  # or your preferred deployment directory
git clone <your-repository-url> whatsapp-automation
cd whatsapp-automation
```

### 3. Ensure the Traefik `proxy` network exists
```bash
docker network ls | grep proxy || docker network create proxy
```

### 4. Build and start the container
```bash
docker compose up -d --build
```

---

## 🔍 Verification & Health Monitoring

### Check container status
```bash
docker compose ps
```

### View real-time container logs
```bash
docker compose logs -f wamarketing-frontend
```

### Test internal health endpoint
```bash
docker exec -it wamarketing-frontend wget -qO- http://localhost/healthz
# Output should be: OK
```

### Test in Browser
Open `https://wamarketing.eightbitsolutions.com` in your web browser:
- Verify that direct navigation to routes like `/dashboard`, `/campaigns`, and `/settings` work.
- Test browser page refresh on any sub-route to confirm SPA routing fallback (`try_files`) works seamlessly.

---

## ⚙️ Architecture & Features

1. **Multi-Stage Docker Build**:
   - Stage 1 (`node:20-alpine`): Installs dependencies cleanly (`npm ci`) and compiles production Vite static bundle.
   - Stage 2 (`nginx:alpine`): Serves optimized static files via lightweight Nginx.
2. **SPA Router Support**:
   - `nginx.conf` is configured with `try_files $uri $uri/ /index.html;` so React Router paths operate without 404 errors on page reload.
3. **Traefik Integration**:
   - Traefik automatically routes traffic for domain `wamarketing.eightbitsolutions.com` over HTTPS using Let's Encrypt certificates.
   - Host ports 80/443 are managed by Traefik and are **not** exposed directly by this container.

---

## 🔄 Updating / Redeploying

To update the application after committing code changes:

```bash
cd /path/to/whatsapp-automation
git pull origin main
docker compose up -d --build
```
