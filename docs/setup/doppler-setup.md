# Doppler Setup for Local Development

**Audience:** Engineers setting up MJAgency for the first time
**Related:** `docs/runbooks/secrets-rotation.md`, `doppler.yaml` (root)

---

## Prerequisites

1. [Doppler CLI](https://docs.doppler.com/docs/install) installed
2. Doppler account credentials (provided by ops — ask in #platform-ops)

Verify CLI is available:
```bash
doppler --version
```

---

## One-time setup

```bash
# Authenticate with Doppler
doppler login

# Configure for this project (select: mjagency project, dev config)
doppler setup
```

`doppler setup` will prompt you to select:
- **Project:** `mjagency`
- **Config:** `dev`

This writes a `.doppler.yaml` to your home directory and links the project root via `doppler.yaml`.

---

## Running the development server

```bash
# Inject dev secrets and start all services
doppler run -- pnpm dev

# Build with secrets
doppler run -- pnpm turbo run build

# Run tests with secrets
doppler run -- pnpm turbo run test
```

`doppler run --` fetches all secrets from the `mjagency/dev` config and injects them as environment variables for the subprocess. No `.env` file needed.

---

## Switching environments

```bash
# Build with staging secrets
doppler run --config=staging -- pnpm turbo run build

# Verify what secrets are active
doppler secrets --config=dev

# Interactive environment switch
doppler switch
```

---

## Verifying your setup

```bash
# Should output your Doppler email address
doppler whoami

# Should list all secrets from mjagency/dev (values masked)
doppler secrets

# Quick smoke test: confirm DATABASE_URL is injected
doppler run -- node -e "console.log(process.env.DATABASE_URL ? 'OK' : 'MISSING')"
```

---

## CI/CD (GitHub Actions)

GitHub Actions uses `DOPPLER_CI_TOKEN` (stored in GitHub repository secrets as a read-only Doppler service token). The workflow authenticates via the `dopplerhq/cli-action@v3` action and runs builds under `doppler run --`.

You do not need to manage this token locally.

---

## Troubleshooting

**"Authentication failed":**
```bash
doppler logout && doppler login
```

**"Config not found":**
Ensure the `mjagency` project has `dev`, `staging`, and `prod` configs. Contact ops if missing.

**"Secret X not found":**
The secret may not yet be populated in Doppler. Check `doppler secrets` — if absent, ask ops to add it to the `mjagency/dev` config.

**Secrets not injected (env vars are undefined):**
Verify you used `doppler run --` prefix. Without it, Doppler does not inject secrets regardless of authentication state.

---

## Rotating secrets

See `docs/runbooks/secrets-rotation.md` for the full rotation procedure.
