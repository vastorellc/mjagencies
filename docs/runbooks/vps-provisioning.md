# VPS Provisioning Runbook (M012 execution)

Per CONTEXT D-01, the production VPS is provisioned in M012 (Phase 12 — Launch). This document
specifies the target spec so M012 has a clear acceptance bar; no provisioning happens at M001.

## Target spec (REQ-006)

- **RAM:** 8 GB minimum
- **Swap:** 4 GB
- **CPU:** 4 vCPU minimum
- **Disk:** 100 GB SSD minimum (Postgres data + WAL + log retention)
- **Network:** static public IP; ingress TLS via Cloudflare proxy
- **OS:** Ubuntu 24.04 LTS (matches CI runner for parity)
- **Topology:** single VPS at M012; per-agency cluster split deferred to post-launch scaling milestone

## Recommended providers

Any of the following meet the spec at M001 target price:

| Provider | Product | RAM | vCPU | Disk | Est. cost/mo |
|---|---|---|---|---|---|
| Hetzner | CPX31 | 8 GB | 4 vCPU | 160 GB NVMe | ~$14 |
| DigitalOcean | General Purpose 8GB | 8 GB | 4 vCPU | 160 GB NVMe | ~$63 |
| Vultr | High Performance 8GB | 8 GB | 4 vCPU | 128 GB NVMe | ~$48 |

Hetzner CPX31 is the reference spec used in development planning. Provider choice is M012
decision; swap the provider but keep the spec floor.

## Provisioning checklist (M012 will execute)

### 1. Base OS

- [ ] Provision VPS at chosen provider with Ubuntu 24.04 LTS
- [ ] Add SSH key pair (no password auth)
- [ ] Set hostname: `mjagency-prod-01`
- [ ] Update packages: `apt update && apt upgrade -y`

### 2. Swap configuration

- [ ] Configure 4 GB swap file:
  ```bash
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```
- [ ] Verify: `free -h` shows 4.0G swap

### 3. Runtime dependencies

- [ ] Install Docker + Docker Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  ```
- [ ] Install PgBouncer 1.21+: `apt install pgbouncer`
- [ ] Install PM2 5.x: `npm install -g pm2@5`
- [ ] Install Doppler CLI:
  ```bash
  curl -Ls https://cli.doppler.com/install.sh | sh
  ```
- [ ] Install Cloudflare Tunnel (cloudflared):
  ```bash
  curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | tee /etc/apt/sources.list.d/cloudflared.list
  apt update && apt install cloudflared
  ```

### 4. Networking and firewall (UFW)

- [ ] Apply UFW rules:
  ```bash
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow 443/tcp comment 'Cloudflare Tunnel'
  ufw enable
  ```
- [ ] Block all other inbound (port 80, 5432, 6379, etc. must NOT be exposed to the internet)
- [ ] Configure Cloudflare Tunnel so `mjagency.com` and subdomains route through the tunnel

### 5. GitHub Actions self-hosted runner (CONTEXT D-02)

- [ ] Register VPS as a self-hosted GitHub Actions runner:
  ```bash
  mkdir /opt/actions-runner && cd /opt/actions-runner
  curl -o runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-<version>.tar.gz
  tar xzf runner.tar.gz
  ./config.sh --url https://github.com/mjagency/mjagency --token <REGISTRATION_TOKEN>
  sudo ./svc.sh install && sudo ./svc.sh start
  ```
- [ ] Update `.github/workflows/*.yml` to use `runs-on: [self-hosted, linux]` after runner is registered

### 6. Storage and backups

- [ ] Mount R2 (or local NVMe) for Postgres backup target via rclone:
  ```bash
  apt install rclone
  rclone config  # configure R2 remote named 'mjagency-r2'
  ```
- [ ] Configure hourly WAL archiving cron:
  ```cron
  0 * * * * pg_basebackup -D /tmp/pgbackup -Ft -z && rclone copy /tmp/pgbackup mjagency-r2:mjagency-backups/$(date +\%Y\%m\%d\%H\%M\%S)/
  ```
- [ ] Verify RPO: backup confirms data recoverable to within 1 hour (REQ-030)

### 7. Acceptance checks (M012 sign-off criteria)

- [ ] `free -h` shows at least 8 GB RAM and 4 GB swap
- [ ] `docker compose --profile dev up -d` runs without errors
- [ ] `pnpm tsx scripts/compose-smoke.ts` exits 0
- [ ] PM2 starts 12 PgBouncer processes: `pm2 jlist | grep pgbouncer | wc -l` == 12
- [ ] All 13 Next.js apps start and `/api/health` returns `{ ok: true }`
- [ ] UFW status shows port 80, 5432, 6379 not accessible from external IP
- [ ] Cloudflare Tunnel active: `cloudflared tunnel list` shows tunnel in healthy state

## Cross-references

- REQ-006 (this doc — VPS spec)
- CONTEXT D-01 (VPS at M012)
- CONTEXT D-02 (CI migration to self-hosted at M012)
- `.planning/phases/01-foundation-infra/01-CONTEXT.md`
- `docs/runbooks/github-setup.md` (runner registration post-migration)
