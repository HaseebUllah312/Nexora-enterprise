# FactoryERP Pro — VPS Deployment Guide

Target: Ubuntu 22.04 LTS VPS (minimum 2 vCPU, 4 GB RAM, 40 GB SSD).  
Tested on DigitalOcean, Hetzner, Vultr, and AWS EC2.

---

## 1. Initial server setup

```bash
# Log in as root, create a deploy user
adduser deploy
usermod -aG sudo deploy
# Paste your public key
mkdir -p /home/deploy/.ssh
cat >> /home/deploy/.ssh/authorized_keys   # paste key, Ctrl+D
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Harden SSH
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Basic firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 2. Install Docker & Docker Compose

```bash
su - deploy   # switch to deploy user for all remaining steps

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
newgrp docker                 # activate group without logout
docker --version              # verify

# Docker Compose plugin (v2)
sudo apt-get install -y docker-compose-plugin
docker compose version
```

---

## 3. Install Nginx & Certbot (for SSL)

```bash
sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

---

## 4. Clone the repository

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/your-org/factory-erp-pro.git
cd factory-erp-pro
```

---

## 5. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env
# ── Set these values ──────────────────────────────────────────────────────────
# DATABASE_URL  — keep pointing to postgres container (see docker-compose)
# JWT_ACCESS_SECRET  — generate: openssl rand -hex 32
# JWT_REFRESH_SECRET — generate: openssl rand -hex 32
# ANTHROPIC_API_KEY  — from console.anthropic.com
# CORS_ORIGIN        — https://your-domain.com
# ──────────────────────────────────────────────────────────────────────────────

# Frontend
cp frontend/.env.local.example frontend/.env.local
nano frontend/.env.local
# NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
```

---

## 6. Update docker-compose.yml for production

Edit `docker-compose.yml` — replace the `environment:` blocks with `env_file:` references
so secrets never appear in compose files committed to git:

```yaml
  backend:
    env_file: ./backend/.env

  frontend:
    env_file: ./frontend/.env.local
```

Also add restart policies and resource limits:

```yaml
  backend:
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 1G }

  frontend:
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 512M }

  postgres:
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 1G }
```

---

## 7. Configure Nginx as reverse proxy with SSL

```bash
sudo nano /etc/nginx/sites-available/factory-erp
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options          "SAMEORIGIN";
    add_header X-Content-Type-Options   "nosniff";
    add_header X-XSS-Protection        "1; mode=block";
    add_header Referrer-Policy          "strict-origin-when-cross-origin";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 20M;

    # API (NestJS backend on port 4000)
    location /api/ {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade     $http_upgrade;
        proxy_set_header   Connection  "upgrade";   # needed for WebSocket
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }

    # WebSocket namespace
    location /realtime/ {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    # Frontend (Next.js on port 3000)
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade     $http_upgrade;
        proxy_set_header   Connection  "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/factory-erp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Issue SSL certificate (DNS must point to this server first)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 8. First deployment

```bash
cd ~/apps/factory-erp-pro

# Build images and start all services
docker compose up -d --build

# Wait for Postgres to be healthy, then run migrations + seed
docker compose exec backend sh -c "npx prisma migrate deploy && npx ts-node prisma/seed.ts"

# Verify services
docker compose ps
docker compose logs backend  --tail 30
docker compose logs frontend --tail 20
```

Navigate to `https://your-domain.com` — login with `owner@factoryerp.local / ChangeMe123!`  
**Change this password immediately in Settings → Security.**

---

## 9. Postgres backups

```bash
# Daily backup cron (runs at 02:00 UTC)
crontab -e
```

Add:

```
0 2 * * * docker exec factory-erp-pro-postgres-1 \
  pg_dump -U erp_user factory_erp \
  | gzip > /home/deploy/backups/factory_erp_$(date +\%Y\%m\%d).sql.gz \
  && find /home/deploy/backups -name "*.sql.gz" -mtime +30 -delete
```

```bash
mkdir -p ~/backups
# Manual backup any time:
docker exec factory-erp-pro-postgres-1 pg_dump -U erp_user factory_erp | gzip > ~/backups/manual_$(date +%Y%m%d_%H%M).sql.gz
```

---

## 10. Zero-downtime updates

```bash
cd ~/apps/factory-erp-pro
git pull

# Rebuild only changed services (Compose detects the diff)
docker compose up -d --build backend
docker compose exec backend npx prisma migrate deploy   # run any new migrations

# Rolling frontend update (Next.js starts before old one stops)
docker compose up -d --build frontend

# Check logs
docker compose logs -f --tail 50
```

---

## 11. Monitoring

```bash
# Service health
docker compose ps

# Resource usage
docker stats

# Disk
df -h

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Application logs
docker compose logs backend  -f
docker compose logs frontend -f
```

For production monitoring, consider adding Uptime Kuma (free, self-hosted):

```bash
docker run -d --restart=always -p 3001:3001 \
  -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

Then add monitors for `https://your-domain.com` and `https://your-domain.com/api/v1/auth/login`.

---

## 12. Scaling (when you outgrow a single VPS)

- **Database**: Move Postgres to a managed service (RDS, Supabase, Neon) — update `DATABASE_URL` in backend `.env`.
- **Backend**: Run 2+ NestJS replicas behind Nginx with `upstream` load balancing.  
  Add `Redis` for session sharing if you add in-memory state (currently stateless).
- **Frontend**: Deploy to Vercel or Cloudflare Pages — set `NEXT_PUBLIC_API_URL` to your API domain.
- **WebSockets**: Add a Redis adapter to Socket.IO so multiple backend instances share the same socket namespace.

---

## Quick reference

| Service   | Internal port | Public URL                     |
|-----------|--------------|--------------------------------|
| Frontend  | 3000         | `https://your-domain.com`      |
| Backend   | 4000         | `https://your-domain.com/api/v1` |
| WebSocket | 4000         | `wss://your-domain.com/realtime` |
| Postgres  | 5432         | Not public (internal only)     |
