# Deploying eInvoices.world on DigitalOcean

A production-ready, self-contained Docker Compose stack. No Emergent
dependencies — everything runs on any Linux host with Docker installed.

---

## 1. Provision a droplet

- Ubuntu 22.04 / 24.04 LTS
- 2 GB RAM minimum (4 GB recommended once real LHDN traffic starts)
- Add your SSH key
- Open ports **22**, **80**, **443** in the DO firewall

## 2. Install Docker

```bash
ssh root@YOUR_DROPLET_IP
curl -fsSL https://get.docker.com | sh
apt install -y git
```

## 3. Clone & configure

```bash
git clone <your-repo-url> einvoices && cd einvoices
cp .env.example .env
nano .env      # fill in JWT_SECRET, ADMIN_*, FRONTEND_URL, CORS_ORIGINS
```

Generate a strong `JWT_SECRET`:
```bash
openssl rand -hex 32
```

## 4. Build & run

```bash
docker compose up -d --build
docker compose logs -f backend   # watch startup + seed
```

Sanity checks:
```bash
curl http://localhost/api/health         # {"status":"ok",...}
curl -X POST http://localhost/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@einvoice.my","password":"<ADMIN_PASSWORD>"}'
```

Open `http://YOUR_DROPLET_IP` in a browser — the platform is live.

## 5. Add TLS (recommended)

The stack ships plain HTTP. Put a reverse proxy in front:

### Option A — Caddy (2-minute setup, auto Let's Encrypt)

```bash
apt install -y caddy
```
`/etc/caddy/Caddyfile`:
```
your-domain.com {
    reverse_proxy localhost:80
}
```
```bash
systemctl reload caddy
```
Then update `.env`:
```
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
WEB_HOST_PORT=8080     # free port 80 for Caddy
```
`docker compose up -d`.

### Option B — DigitalOcean Load Balancer
Point it at the droplet's port 80 with a managed cert. Set `WEB_HOST_PORT=80`
and `FRONTEND_URL=https://your-domain.com`.

## 6. LHDN MyInvois preprod credentials

After the platform is up:
1. Log in as the admin account.
2. Open **Gov API Config**.
3. Paste your LHDN `client_id`, `client_secret`, environment `preprod`,
   and (optionally) X.509 certificate + private key.
4. Fill in `gloco_tin` — the TIN LHDN registered against your OAuth client
   (visible in the JWT's `TaxpayerTIN` claim). This lets the adapter skip
   the `onbehalfof` header for direct submissions.
5. Click **Verify** — you should see a green tick.

## 7. Backups

```bash
# Nightly cron: mongodump + rotate
docker compose exec -T mongo mongodump --archive --db=einvoices \
     > /var/backups/einvoices-$(date +%F).archive
```

## 8. Upgrades

```bash
git pull
docker compose up -d --build
```

Zero-downtime tip: bring up a second stack on a different port, flip DNS,
then tear down the old.

## 9. Where things live inside the container

| Concern              | Location                          |
|----------------------|-----------------------------------|
| App code (backend)   | `/app` in `backend` container     |
| SPA static files     | `/usr/share/nginx/html` in `web`  |
| Mongo data           | named volume `mongo_data`         |
| Logs                 | `docker compose logs <service>`   |

## 10. Environment variables reference

See `.env.example` in the repo root. The critical ones are:

| Variable            | Purpose                                            |
|---------------------|----------------------------------------------------|
| `JWT_SECRET`        | Signs API tokens. Rotate = invalidates all logins. |
| `ADMIN_EMAIL/PWD`   | Seeded on first boot (idempotent).                 |
| `FRONTEND_URL`      | Used in QR approve links + SDK snippets.           |
| `CORS_ORIGINS`      | `*` for dev, exact origin(s) for prod.             |
| `MONGO_URL`         | Change to a managed cluster URI if desired.        |

## 11. Health & monitoring

- Backend liveness: `GET /api/health`
- Nginx liveness:   `GET /` (returns index.html)
- Mongo:            `docker compose exec mongo mongosh --eval "db.adminCommand('ping')"`

For real production monitoring, plug the stack into DO Monitoring, Grafana
Cloud, or Datadog by scraping the endpoints above.
