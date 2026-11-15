# Deployment

Two processes from one image (`Dockerfile`), selected by `APP_MODE`:

| Process | `APP_MODE` | Serves |
|---|---|---|
| `admin` | `admin` | Dashboard and API, only on the `ADMIN_BASE_URL` host |
| `public` | `public` | Public news-site routes only (`/`, `/articles/*`, `/kategori/*`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/domain-check`) |

`deploy/docker-compose.yml` adds Caddy with on-demand TLS: a certificate is requested for a hostname only if `public:3000/domain-check?domain=<host>` returns 200, i.e. the hostname is an active, verified `Domain` of an ACTIVE media. Unknown names never get certificates.

## Steps

1. Server with Docker, ports 80/443 free (do not share with another Caddy/nginx; see "Sharing a server").
2. PostgreSQL reachable from the containers; `npm run db:deploy` once (from any machine with the repo and `DATABASE_URL`) and `npm run db:seed`.
3. Create `.env.production` from `.env.example`: `DATABASE_URL`, `SESSION_SECRET` (>= 32 chars), `ADMIN_BASE_URL=https://<admin domain>`, Cloudinary and AI keys, plus `ADMIN_DOMAIN` and `ACME_EMAIL` for Caddy. Never commit it.
4. `docker compose -f deploy/docker-compose.yml --env-file .env.production up -d --build`.
5. For each media: point the domain's DNS A/AAAA record at the server, add it under the media in the dashboard, and verify it. Only then does the first HTTPS request obtain a certificate.

## Sharing a server

If the server already runs a reverse proxy on 80/443, keep it and add two upstreams instead of the bundled Caddy: the admin host to `admin:3000` and every media host to `public:3000` (the proxy must forward the original `Host` header, because tenant resolution uses it). Drop the `caddy` service and attach `admin`/`public` to the existing proxy's Docker network. Memory: each process is limited to 512 MB in the compose file; size the server accordingly.

## Not covered

Redis/BullMQ worker (`npm run worker`), scheduled publishing and restart-safe AI jobs need a Redis service; a shared rate limiter for multiple instances; off-server database backups; CDN cache rules (cache keys must include the host).

## Current live setup (shared VPS)

The bundled Caddy is not used on the shared VPS. The containers join the existing proxy network and each hostname gets a Caddy block (see `IMPLEMENTATION_STATUS.md`). Redeploy: build `nnms:prod` locally, `docker save nnms:prod | gzip | ssh <vps> 'gunzip | docker load'`, then recreate `nnms-admin` and `nnms-public` with `--network nnms-net --env-file /opt/nnms/.env.production -e APP_MODE=...` and `docker network connect saturoom-app_edge` for both (the attachment is lost when a container is recreated).

## Adding a media domain (shared VPS, no server edit)

The shared Caddy uses on-demand TLS gated by `nnms-public:3000/domain-check`. To add a media domain: point its A record at `PUBLIC_SERVER_IP`, add the hostname under the media in the dashboard, press Konfirmasi, open the address once. Do not add per-domain Caddy blocks. Cloudflare proxying must be off for the record (the certificate challenge needs a direct connection).
