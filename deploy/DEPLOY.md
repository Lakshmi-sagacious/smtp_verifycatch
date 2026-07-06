# Deploy runbook — smtp.verifycatch.com

Ubuntu 24.04 EC2 at 52.71.95.79. Dashboard-only Phase 1 (API + web + mailer + webhooks-worker).
Phase 2 (smtp-in / smtp-out + Security Group changes) comes later.

## Prereqs already true on the server

- Node 20, PM2, nginx, certbot, Postgres 15, Redis 7 — verified in handoff doc
- Existing api-gateway on :3000 (do NOT touch)
- Free port: 4000

## Step 0 — DNS (do this first)

Route 53 console → verifycatch.com zone → Create record:
- Name: `smtp`
- Type: A
- Value: 52.71.95.79
- TTL: 300

Then wait ~2 minutes and confirm from your laptop:
```
nslookup smtp.verifycatch.com
```
Should return 52.71.95.79.

## Step 1 — push code to the server

**Option A — via git (recommended if you have a remote):**
```bash
# on your Windows box, first push to a private repo (GitHub/GitLab)
git init && git add . && git commit -m "phase 2b + deploy artifacts"
git remote add origin git@github.com:you/smtp-platform.git
git push -u origin main
```

**Option B — via rsync:**
```powershell
# from C:\smtp on Windows
scp -i C:/Users/SIS210/Downloads/email-verification.pem -r . ubuntu@52.71.95.79:/tmp/smtp-app
```

## Step 2 — SSH in

```powershell
ssh -i C:/Users/SIS210/Downloads/email-verification.pem ubuntu@52.71.95.79
```

## Step 3 — put the code at /opt/smtp-app

```bash
sudo mkdir -p /opt/smtp-app
sudo chown -R ubuntu:ubuntu /opt/smtp-app

# If Option A (git):
git clone git@github.com:you/smtp-platform.git /opt/smtp-app

# If Option B (rsync landed in /tmp/smtp-app):
mv /tmp/smtp-app/* /tmp/smtp-app/.* /opt/smtp-app/ 2>/dev/null || true

cd /opt/smtp-app
ls -la   # confirm apps/, packages/, deploy/ are here
```

## Step 4 — install pnpm + deps

```bash
sudo corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version   # 9.12.0

df -h /   # check remaining space BEFORE install
pnpm install --frozen-lockfile   # takes 2-3 min, ~500 MB
df -h /   # verify still > 500 MB free
```

## Step 5 — create the DB + role

```bash
sudo -u postgres psql <<'SQL'
CREATE USER smtp_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE smtp_platform OWNER smtp_app;
GRANT ALL PRIVILEGES ON DATABASE smtp_platform TO smtp_app;
SQL
```

## Step 6 — write the production .env

```bash
cp deploy/.env.production.example .env
nano .env
```

Fill in every `TODO_*` value:
- `DATABASE_URL` password → the one you set in Step 5
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` → generate with `openssl rand -hex 32` each
- `MAILER_RELAY_USER` and `MAILER_RELAY_PASS` → your Gmail address + app password

Save (Ctrl+O, Enter, Ctrl+X).

## Step 7 — run Prisma migrations

```bash
pnpm --filter @smtp/db exec dotenv -e /opt/smtp-app/.env -- prisma migrate deploy
```

Should print: "Applying migration `...`" and then "The database schema is now in sync."

## Step 8 — build everything

```bash
pnpm build:pkgs                          # @smtp/db + @smtp/shared → dist/
pnpm --filter @smtp/api build            # nest build → apps/api/dist/main.js
pnpm --filter @smtp/mailer build         # tsc → apps/mailer/dist/main.js
pnpm --filter @smtp/webhooks-worker build
pnpm --filter @smtp/web build            # vite build → apps/web/dist/

# sanity check
ls apps/api/dist/main.js apps/mailer/dist/main.js apps/webhooks-worker/dist/main.js apps/web/dist/index.html
```

## Step 9 — start under PM2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save               # persist to ~/.pm2/dump.pm2
pm2 list               # should show api-gateway + smtp-api + smtp-mailer + smtp-webhooks-worker, all "online"

# quick smoke test on API
curl http://127.0.0.1:4000/api/health   # {"ok":true,"ts":"..."}
```

If any process is `errored`, check logs:
```bash
pm2 logs smtp-api --lines 50
```

## Step 10 — nginx site

```bash
sudo cp deploy/nginx-smtp.verifycatch.com.conf /etc/nginx/sites-available/smtp.verifycatch.com
sudo ln -s /etc/nginx/sites-available/smtp.verifycatch.com /etc/nginx/sites-enabled/smtp.verifycatch.com
sudo nginx -t          # syntax OK?
sudo systemctl reload nginx
```

Test HTTP (before TLS):
```bash
curl -I http://smtp.verifycatch.com/    # 200 OK, serving index.html
curl http://smtp.verifycatch.com/api/health   # {"ok":true,...}
```

## Step 11 — HTTPS via Let's Encrypt

```bash
sudo certbot --nginx -d smtp.verifycatch.com
# When prompted: enter an email, agree to TOS, and choose "2" to redirect HTTP → HTTPS.
```

Test:
```bash
curl -I https://smtp.verifycatch.com/     # 200
curl https://smtp.verifycatch.com/api/health   # {"ok":true,...}
```

## Step 12 — survive reboots

```bash
pm2 startup systemd    # will print a `sudo env PATH=...` command — run exactly what it prints
pm2 save
```

## Step 13 — verify the untouched production app

```bash
curl http://localhost:3000/healthz   # api-gateway still 200
pm2 status api-gateway               # still online
```

## Step 14 — smoke test end-to-end

Open https://smtp.verifycatch.com/signup in your browser, create an account, add a domain
(remember: DEV_SKIP_DNS_CHECK is OFF in prod, so DKIM must be actually published for the
domain to verify), create an API key, and send:

```bash
curl -X POST https://smtp.verifycatch.com/api/send \
  -H "X-API-Key: smtp_live_..." \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@yourverifieddomain.com","to":"you@gmail.com","subject":"Prod test","text":"Live."}'
```

## Rollback (if things go wrong)

```bash
pm2 stop smtp-api smtp-mailer smtp-webhooks-worker
pm2 delete smtp-api smtp-mailer smtp-webhooks-worker
sudo rm /etc/nginx/sites-enabled/smtp.verifycatch.com
sudo systemctl reload nginx
# leaves /opt/smtp-app and DB/data intact for later retry
```

## Phase 2 (later) — enable SMTP protocol servers

When ready to accept customer SMTP submissions (port 587) and inbound sandbox catches (port 2525):

1. AWS Security Group → add inbound TCP 587 and 2525 from 0.0.0.0/0
2. Uncomment `SMTP_IN_*` and `SMTP_OUT_*` blocks in `/opt/smtp-app/.env`
3. Build the two services:
   ```bash
   pnpm --filter @smtp/smtp-in build
   pnpm --filter @smtp/smtp-out build
   ```
4. Add them to `ecosystem.config.cjs` and `pm2 start` them
5. Test with `swaks --to test@x --server smtp.verifycatch.com --port 587 --auth-user ... --auth-password ...`
