// PM2 process manifest for smtp.verifycatch.com deployment.
// Phase 1: dashboard + REST + delivery + webhooks. Phase 2 (later) adds smtp-in/smtp-out
// once the Security Group is opened for their inbound ports.
//
// Each process:
//   * reads /opt/smtp-app/.env at boot (dotenv is loaded by each service's config.ts)
//   * logs go to ~/.pm2/logs/<name>-{out,error}.log
//   * autorestarts on crash, capped by max_restarts

module.exports = {
  apps: [
    {
      name: 'smtp-api',
      script: './apps/api/dist/main.js',
      cwd: '/opt/smtp-app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'smtp-mailer',
      script: './apps/mailer/dist/main.js',
      cwd: '/opt/smtp-app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'smtp-webhooks-worker',
      script: './apps/webhooks-worker/dist/main.js',
      cwd: '/opt/smtp-app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '250M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
