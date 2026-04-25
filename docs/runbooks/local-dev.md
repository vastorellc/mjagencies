# Local Development Runbook

This runbook covers first-time setup and day-to-day development for all supported operating systems (macOS, Linux, Windows native, WSL2).

## Prerequisites

Install the following before proceeding:

- **Node 22** via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22 && nvm use 22`) or [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows native
- **pnpm 10.x** via Corepack: `corepack enable && corepack prepare pnpm@10.33.2 --activate`
- **Docker 24+** with Compose v2.20+: `docker --version && docker compose version`
- **PgBouncer 1.21+**: installed via PM2 Docker container (Plan 01-02 ships the compose config)
- **PM2 5.x**: `npm install -g pm2@5`
- **Doppler CLI**: `curl -Ls https://cli.doppler.com/install.sh | sh` (macOS/Linux) or via [Scoop](https://docs.doppler.com/docs/install-cli) on Windows
- **Stripe CLI**: `brew install stripe/stripe-cli/stripe` (macOS) or see [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli) for other platforms

## First-Time Setup

Follow these six steps in order:

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url> mjagency && cd mjagency
   pnpm install --frozen-lockfile
   ```

2. **Add localhost entries to your hosts file**

   This maps the 13 agency subdomains (`brand.localhost`, `ecommerce.localhost`, …) to 127.0.0.1 so the Next.js dev server can distinguish agencies by Host header. The full entry that will be appended is:

   ```
   127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost
   ```

   On **macOS / Linux**:
   ```bash
   ./scripts/setup-hosts.sh
   ```

   On **Windows (elevated PowerShell)**:
   ```powershell
   Start-Process pwsh -Verb RunAs -ArgumentList "scripts/setup-hosts.ps1"
   ```

3. **Start the Docker Compose stack** (Plan 01-02 ships `docker-compose.yml`)
   ```bash
   docker compose --profile dev up -d
   ```
   This brings up Postgres 17 (13 logical databases), Redis 7, Mailhog, PgAdmin, and the Stripe CLI webhook forwarder.

4. **Start PgBouncer and PM2 dev supervisor** (Plan 01-02 ships `ecosystem.config.cjs`)
   ```bash
   pm2 start ecosystem.config.cjs
   ```
   This starts 13 PgBouncer processes (ports 6432–6444) plus Promtail and Stripe CLI in dev mode.

5. **Authenticate Doppler and pull secrets** (Plan 01-06 ships `doppler.yaml`)
   ```bash
   doppler login
   doppler setup
   ```
   Each app has its own Doppler config (`mjagency-brand`, `mjagency-ecommerce`, etc.) that injects `DATABASE_URL`, `PAYLOAD_SECRET`, `JWT_SECRET`, and other required env vars at runtime.

6. **Start the main brand app**
   ```bash
   pnpm dev --filter=@mjagency/web-main
   ```
   Visit `http://brand.localhost:3000` — homepage loads. Visit `http://brand.localhost:3000/admin` to complete the Payload first-user wizard (requires Postgres from Step 3).

## Per-OS Hosts Notes

### macOS

`/etc/hosts` requires `sudo`. Run `./scripts/setup-hosts.sh` which calls `sudo tee -a`. The entries persist across reboots. To verify: `cat /etc/hosts | grep localhost`.

### Linux

Same as macOS. If running in a container, you may also need to add entries to the container's `/etc/hosts`. Run `./scripts/setup-hosts.sh`.

### Windows Native (PowerShell elevated)

The hosts file is at `C:\Windows\System32\drivers\etc\hosts`. Run `setup-hosts.ps1` in an elevated PowerShell session:
```powershell
Start-Process pwsh -Verb RunAs -ArgumentList ".\scripts\setup-hosts.ps1"
```
After adding entries, browsers will resolve `brand.localhost` to 127.0.0.1. Edge and Chrome do this natively; Firefox may need `network.dns.localDomains` set to `brand.localhost,ecommerce.localhost,...` in `about:config`.

### WSL2

WSL2 has two hosts files that must both be updated:

1. **Windows hosts file** (controls browser access from Windows): run `setup-hosts.ps1` as above.
2. **WSL2 `/etc/hosts`** (controls access from inside WSL): run `./scripts/setup-hosts.sh` inside your WSL terminal.

If you only update the Windows hosts file, commands run inside WSL (e.g. `curl http://brand.localhost:3000`) will not resolve. Both files must have the 13 entries.

## Architecture Spec Divergence

`mjagency/specs/architecture.md` line 364 references `*.mjagency.local` as the local subdomain pattern. **CONTEXT D-06 overrides this** — the implementation uses `*.localhost` entries in `/etc/hosts`. The reasons are:

- `*.localhost` works in all modern browsers without additional DNS configuration
- Windows native (without WSL) does not automatically resolve `*.local` domains
- Offline development works reliably with `/etc/hosts` entries vs. DNS
- Per RESEARCH §2.12: RFC 6761 §6.3 browser behavior + Next.js Host matching edge cases make `*.localhost` more reliable than `*.local`

The spec is stale on this point. Follow CONTEXT D-06 (`*.localhost`). See also `.planning/phases/01-foundation-infra/01-RESEARCH.md §2.12` final paragraph.

## CLAUDE.md / PROJECT.md Parity

Two copies of the doctrine files exist:
- `mjagency/CLAUDE.md` and `mjagency/PROJECT.md` — **canonical source** (read-only spec)
- `./CLAUDE.md` and `./PROJECT.md` — **repo root copies** (consumed by Claude Code agents at session start)

Plan 01-05 ships a CI parity check (`scripts/check-claude-md-parity.sh`) that fails the PR pipeline if the two copies diverge. To update doctrine:
```bash
# Edit mjagency/CLAUDE.md or mjagency/PROJECT.md first, then sync:
cp mjagency/CLAUDE.md ./CLAUDE.md
cp mjagency/PROJECT.md ./PROJECT.md
```
Never edit the root copies directly — they will be overwritten.

## Manual Admin First-User Wizard Gate

After completing Steps 1–5, hit `http://brand.localhost:3000/admin` in a browser. Payload will redirect you to the first-user creation form. Complete this once to create the super_admin account. This gate is part of Plan 01-02 Task 2.1 verification — it requires Postgres to be running.

Note: At M001 (Plan 01-01), the health route (`/api/health`) verifies the app boots, but the admin wizard gate is deferred to Plan 01-02 when Postgres is available.

## Compose Stack

### Profiles

The `docker-compose.yml` ships two profiles:

| Profile | Services included | Use case |
|---------|-------------------|----------|
| *(none, default)* | `postgres`, `redis` | Minimal local stack; fastest startup |
| `dev` | `postgres`, `redis`, `mailhog`, `pgadmin`, `stripe-cli` | Full local dev with email preview, DB GUI, and Stripe webhook forwarding |

### Starting the stack

```bash
# Core only (Postgres 17 + Redis 7) — suitable for backend-only work
docker compose up -d

# Full dev stack — required for first-user Payload wizard and email testing
docker compose --profile dev up -d

# Stop all services
docker compose --profile dev down
```

### Service inventory

| Service | Image | Host port | Purpose |
|---------|-------|-----------|---------|
| `postgres` | `postgres:17.2-alpine` | `127.0.0.1:5432` | Single container with 12 logical DBs + roles |
| `redis` | `redis:7.4-alpine` | `127.0.0.1:6379` | Shared, namespaced by `agency:<id>:*` prefix |
| `mailhog` *(dev)* | `mailhog/mailhog:v1.0.1` | `127.0.0.1:1025` (SMTP), `127.0.0.1:8025` (UI) | Catch-all email preview |
| `pgadmin` *(dev)* | `dpage/pgadmin4:8.13` | `127.0.0.1:5050` | DB GUI pre-configured with all 12 agency connections |
| `stripe-cli` *(dev)* | `stripe/stripe-cli:v1.21.8` | — | Forwards webhooks to `host.docker.internal:3000/api/stripe/webhook` |

Security note: all host port bindings use `127.0.0.1` (not `0.0.0.0`) — no LAN exposure.

### Database layout

Postgres 17 hosts 12 logical databases, one per agency:

| Agency | Database | Role | PgBouncer port |
|--------|----------|------|----------------|
| brand | `brand_db` | `brand_user` | 6432 |
| ecommerce | `ecommerce_db` | `ecommerce_user` | 6433 |
| growth | `growth_db` | `growth_user` | 6434 |
| webdev | `webdev_db` | `webdev_user` | 6435 |
| ai | `ai_db` | `ai_user` | 6436 |
| branding | `branding_db` | `branding_user` | 6437 |
| strategy | `strategy_db` | `strategy_user` | 6438 |
| finance | `finance_db` | `finance_user` | 6439 |
| engineering | `engineering_db` | `engineering_user` | 6440 |
| product | `product_db` | `product_user` | 6441 |
| video | `video_db` | `video_user` | 6442 |
| graphic | `graphic_db` | `graphic_user` | 6443 |

Port 6444 is reserved for the M002 platform-shared admin connection.

### Waiting for Postgres before starting apps (pitfall 3.12)

Apps that start before Postgres is ready will fail with connection errors. Always confirm
Postgres is ready before running `pnpm dev`:

```bash
# Wait until Postgres accepts connections on port 5432
wait-on tcp:5432

# Or manually check:
docker compose ps postgres   # look for Status = "healthy"
```

The `scripts/compose-smoke.ts` helper (used by CI) polls all containers until healthy
with a 120-second timeout.

### PgAdmin

Navigate to `http://127.0.0.1:5050` after running `docker compose --profile dev up -d`.
All 12 agency connections are pre-configured via `infra/pgadmin/servers.json`. No manual
setup is required. Credentials: `dev@localhost` / `dev` (local only, not used in production).

### Stripe CLI webhook forwarding

The `stripe-cli` service (dev profile) forwards incoming Stripe events to
`host.docker.internal:3000/api/stripe/webhook`. This requires a `sk_test_*` test-mode key in
`STRIPE_TEST_API_KEY`. Never use a live key here — see D-03 and pitfall 3.10.

## Troubleshooting

- **`pnpm install` fails with frozen-lockfile**: run `pnpm install` (no flag) to regenerate the lockfile, then commit `pnpm-lock.yaml`.
- **Port already in use**: each agency app uses a fixed port (brand=3000, ecommerce=3001, …, graphic=3011). Run `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows) to find the conflicting process.
- **`brand.localhost` does not resolve**: check `/etc/hosts` on both Windows and WSL2 (if applicable). Flush DNS: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (macOS).
- **Payload admin loads but shows DB error**: Postgres is not running. Run `docker compose --profile dev up -d` and wait for the healthcheck to pass.
- **PgAdmin cannot reach Postgres**: `host.docker.internal` must resolve to the Docker host. On Linux, add `--add-host=host.docker.internal:host-gateway` to the pgadmin service if the connection fails (this is automatic on Docker Desktop for macOS/Windows).
