// ecosystem.config.cjs — PM2 dev supervisor for MJAgency local development
// Manages: 12 PgBouncer processes + Stripe CLI + Promtail (active from Plan 01-04)
//
// Usage:
//   pm2 start ecosystem.config.cjs                         # start all active processes
//   pm2 start ecosystem.config.cjs --only pgbouncer-brand  # start a single PgBouncer
//   pm2 restart pgbouncer-ecommerce                        # restart one instance
//   pm2 logs pgbouncer-brand --lines 50                    # tail logs
//   pm2 stop all && pm2 delete all                         # stop + remove all processes
//
// Port assignment (RESEARCH §2.4, D-05):
//   brand=6432, ecommerce=6433, growth=6434, webdev=6435, ai=6436,
//   branding=6437, strategy=6438, finance=6439, engineering=6440,
//   product=6441, video=6442, graphic=6443
//   Port 6444 is reserved for the M002 platform-shared admin connection.

'use strict'

const agencies = [
  'brand',
  'ecommerce',
  'growth',
  'webdev',
  'ai',
  'branding',
  'strategy',
  'finance',
  'engineering',
  'product',
  'video',
  'graphic',
]

/** @type {import('pm2').StartOptions[]} */
const pgbouncerApps = agencies.map((slug) => ({
  name: `pgbouncer-${slug}`,
  script: 'pgbouncer',
  // No -d flag: PM2 supervises in foreground mode — PgBouncer should not daemonize itself.
  // PgBouncer resolves auth_file relative to the config file location (infra/pgbouncer/).
  args: `infra/pgbouncer/pgbouncer.${slug}.ini`,
  cwd: __dirname,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 2000,
  error_file: `./logs/pgbouncer-${slug}.err.log`,
  out_file: `./logs/pgbouncer-${slug}.out.log`,
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
}))

/** @type {import('pm2').StartOptions} */
const stripeListenerApp = {
  name: 'stripe-listener',
  script: 'stripe',
  args: 'listen --forward-to localhost:3000/api/stripe/webhook',
  cwd: __dirname,
  autorestart: true,
  max_restarts: 5,
  restart_delay: 3000,
  error_file: './logs/stripe-listener.err.log',
  out_file: './logs/stripe-listener.out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  // SECURITY: only sk_test_* keys — live keys are PROHIBITED here (D-03, pitfall 3.10)
  env: {
    STRIPE_API_KEY: process.env.STRIPE_TEST_API_KEY,
  },
}

// Promtail activated in Plan 01-04 — infra/promtail/promtail-config.yml now exists.
// Ships logs from all Docker containers to Loki with agency_id labels.
/** @type {import('pm2').StartOptions} */
const promtailApp = {
  name: 'promtail',
  script: 'promtail',
  args: '-config.file=infra/promtail/promtail-config.yml',
  cwd: __dirname,
  autorestart: true,
  max_restarts: 5,
  restart_delay: 3000,
  error_file: './logs/promtail.err.log',
  out_file: './logs/promtail.out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
}

module.exports = {
  apps: [
    ...pgbouncerApps,
    stripeListenerApp,
    promtailApp,
  ],
}
