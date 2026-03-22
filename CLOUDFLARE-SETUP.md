# Cloudflare + Deployment Setup — Konma Xperience

## Domain: konma.store
## Architecture

```
konma.store (frontend)  →  Vercel
api.konma.store (backend)  →  Railway
db: Neon PostgreSQL
redis: Upstash Redis
storage: Cloudflare R2
email: MailerSend

All traffic routes through Cloudflare first.
```

```
Users
  ↓
Cloudflare Edge (250+ cities)
  ├── DDoS mitigation (automatic, unmetered)
  ├── WAF rules (5 custom)
  ├── Bot Fight Mode
  ├── SSL termination
  └── JS challenge (if suspicious)
       ↓ clean traffic only
  ┌────────────────────────────────────┐
  │  konma.store → Vercel (frontend)   │
  │  api.konma.store → Railway (backend)│
  └────────────────────────────────────┘
       ↓
  Neon (PostgreSQL) + Upstash (Redis) + R2 (Storage)
```

---

## Part 1: Cloudflare Setup

### Step 1: Add konma.store to Cloudflare

1. Go to https://dash.cloudflare.com
2. Click **"Add a Site"**
3. Enter: `konma.store`
4. Select **Free** plan → Continue
5. Cloudflare scans your DNS — verify records → Continue
6. Copy the 2 nameservers Cloudflare gives you

### Step 2: Update Nameservers on GoDaddy

1. Go to https://dcc.godaddy.com (GoDaddy Domain Control Center)
2. Click on **konma.store**
3. Scroll down to **Nameservers** section
4. Click **"Change"** (next to the current nameservers)
5. Select **"Enter my own nameservers (advanced)"**
6. Delete the existing GoDaddy nameservers
7. Enter the 2 Cloudflare nameservers:
   ```
   Nameserver 1: ada.ns.cloudflare.com
   Nameserver 2: bob.ns.cloudflare.com
   ```
   (Use the exact ones Cloudflare gave you — these are examples)
8. Click **Save**
9. GoDaddy shows a warning "You're about to update nameservers" → click **Continue**
10. Wait 10 min – 24 hours for propagation (usually 15-30 min for GoDaddy)
11. Cloudflare emails you when your site is active

**GoDaddy-specific notes:**
- GoDaddy may show "Your DNS is not managed by GoDaddy" after this — that's correct, Cloudflare manages it now
- Do NOT delete the domain from GoDaddy — you still own it there, only DNS moves to Cloudflare
- If GoDaddy asks you to verify, check your email for a confirmation link
- Auto-renew on GoDaddy should stay ON — the domain registration stays with GoDaddy

### Step 3: Configure DNS Records

**Dashboard → DNS → Records**

| Type  | Name   | Content                          | Proxy  | Notes |
|-------|--------|----------------------------------|--------|-------|
| CNAME | @      | cname.vercel-dns.com             | OFF    | Vercel frontend (see note below) |
| CNAME | www    | cname.vercel-dns.com             | OFF    | Vercel frontend |
| CNAME | api    | your-app.up.railway.app          | **ON** | Railway backend — PROXY ON |

**Important notes:**
- The `api` subdomain MUST have orange cloud (Proxy ON) for DDoS/WAF protection
- Vercel requires proxy OFF for their DNS verification. After Vercel domain is verified, you CAN turn proxy ON for `@` and `www` too — but test first as Vercel's edge network handles its own caching/SSL
- Replace `your-app.up.railway.app` with your actual Railway deployment URL

**After Vercel domain verification succeeds, optionally turn proxy ON for @ and www:**

| Type  | Name   | Content                          | Proxy  |
|-------|--------|----------------------------------|--------|
| CNAME | @      | cname.vercel-dns.com             | **ON** |
| CNAME | www    | cname.vercel-dns.com             | **ON** |
| CNAME | api    | your-app.up.railway.app          | **ON** |

### Step 4: SSL/TLS

**Dashboard → SSL/TLS → Overview**
- Encryption mode: **Full (Strict)**

**Dashboard → SSL/TLS → Edge Certificates**
- Always Use HTTPS: **ON**
- Minimum TLS Version: **TLS 1.2**
- TLS 1.3: **ON**
- Automatic HTTPS Rewrites: **ON**

### Step 5: Security Settings

**Dashboard → Security → Settings**
- Security Level: **Medium**
- Challenge Passage: **30 minutes**
- Browser Integrity Check: **ON**
- Privacy Pass: **ON**

### Step 6: DDoS Protection

**Dashboard → Security → DDoS**
- Already ON by default (automatic, unmetered, can't turn off)
- Sensitivity: **Medium**
- Action: **Block**

Nothing to configure.

### Step 7: Bot Protection

**Dashboard → Security → Bots**
- Bot Fight Mode: **ON**
- JavaScript Detections: **ON**
- Block AI Scrapers and Crawlers: **ON**

### Step 8: WAF Custom Rules (5 free)

**Dashboard → Security → WAF → Custom Rules → Create rule**

#### Rule 1: Block Exploit Scanners
```
Name: Block common attack paths
When:
  (http.request.uri.path contains "/wp-admin") or
  (http.request.uri.path contains "/phpmyadmin") or
  (http.request.uri.path contains "/.env") or
  (http.request.uri.path contains "/.git") or
  (http.request.uri.path contains "/xmlrpc") or
  (http.request.uri.path contains "/config.") or
  (http.request.uri.path contains "/backup")
Then: Block
```

#### Rule 2: Protect Auth Endpoints
```
Name: Challenge auth brute force
When:
  (http.request.uri.path contains "/auth/login" and http.request.method eq "POST") or
  (http.request.uri.path contains "/auth/forgot-password" and http.request.method eq "POST") or
  (http.request.uri.path contains "/auth/reset-password" and http.request.method eq "POST")
Then: Managed Challenge
```

#### Rule 3: Protect Public Write Endpoints
```
Name: Challenge public submissions
When:
  (http.request.uri.path contains "/feedback" and http.request.method eq "POST") or
  (http.request.uri.path contains "/bookings" and http.request.method eq "POST")
Then: Managed Challenge
```

#### Rule 4: Block Bad Bots
```
Name: Block malicious tools
When:
  (http.user_agent contains "sqlmap") or
  (http.user_agent contains "nikto") or
  (http.user_agent contains "masscan") or
  (http.user_agent contains "python-requests") or
  (http.user_agent eq "")
Then: Block
```

#### Rule 5: Geographic Restriction (Optional — skip if international visitors expected)
```
Name: Challenge non-India traffic
When:
  (ip.geoip.country ne "IN")
Then: Managed Challenge
```

### Step 9: Speed & Performance

**Dashboard → Speed → Optimization**
- Auto Minify: **CSS + JS**
- Brotli: **ON**
- Early Hints: **ON**

**Dashboard → Speed → Optimization → Protocol Optimization**
- HTTP/2: **ON**
- HTTP/3 (QUIC): **ON**

### Step 10: Caching

**Dashboard → Caching → Configuration**
- Caching Level: **Standard**
- Browser Cache TTL: **Respect Existing Headers**
- Always Online: **ON**

**Dashboard → Rules → Page Rules** (3 free)

#### Page Rule 1: Bypass cache for API
```
URL: api.konma.store/*
Setting: Cache Level → Bypass
```

#### Page Rule 2: Cache static assets
```
URL: konma.store/_next/static/*
Settings:
  Cache Level → Cache Everything
  Edge Cache TTL → 1 month
```

#### Page Rule 3: Cache public menu page
```
URL: konma.store/menu*
Settings:
  Cache Level → Cache Everything
  Edge Cache TTL → 5 minutes
```

### Step 11: Emergency — Under Attack Mode

If actively being DDoSed:
1. **Dashboard → Overview → Quick Actions**
2. Toggle **"Under Attack Mode"** → ON
3. Shows 5-second JS challenge to ALL visitors
4. Turn OFF when attack stops

---

## Part 2: Vercel Deployment (Frontend)

### Step 1: Connect Repository

1. Go to https://vercel.com/new
2. Import your Git repository
3. Set **Root Directory** to `frontend`
4. Framework Preset: **Next.js**
5. Click **Deploy**

### Step 2: Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_API_URL=https://api.konma.store
```

### Step 3: Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add `konma.store`
3. Add `www.konma.store`
4. Vercel will show DNS instructions — you already configured this in Cloudflare Step 3
5. Wait for domain verification (check mark appears)

### Step 4: Verify

- Visit https://konma.store — should load the frontend
- Visit https://www.konma.store — should redirect to konma.store
- Check browser console — API calls should go to https://api.konma.store

---

## Part 3: Railway Deployment (Backend)

### Step 1: Create Project

1. Go to https://railway.com/new
2. Click **"Deploy from GitHub Repo"**
3. Select your repository
4. Set **Root Directory** to `backend`

### Step 2: Configure Build

In Railway Dashboard → Service → Settings:

```
Build Command: npm run build
Start Command: npm run start:prod
Watch Paths: /backend/**
```

### Step 3: Environment Variables

In Railway Dashboard → Variables, add ALL of these:

```
# Database (from Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/konmaxperience?sslmode=require

# JWT
JWT_SECRET=<generate-a-64-char-random-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email (MailerSend)
MAILERSEND_API_KEY=<your-mailersend-api-key>
MAILERSEND_FROM_EMAIL=noreply@konma.store

# Frontend URL (for CORS and email links)
FRONTEND_URL=https://konma.store

# Cloudflare R2 (Evidence Storage)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret-key>
R2_BUCKET_NAME=konma-evidence
R2_PUBLIC_URL=https://<your-bucket>.r2.dev

# Redis (Upstash)
UPSTASH_REDIS_URL=rediss://default:<token>@<endpoint>.upstash.io:6379

# Server
PORT=4000
NODE_ENV=production
```

### Step 4: Custom Domain

1. Railway Dashboard → Service → Settings → Networking → Custom Domain
2. Add `api.konma.store`
3. Railway shows a CNAME target (e.g., `your-app.up.railway.app`)
4. You already configured this in Cloudflare Step 3
5. Wait for verification (green check)

### Step 5: Database Migration

After first deploy, open Railway's terminal or run locally:

```bash
cd backend
DATABASE_URL="<your-neon-url>" npx prisma db push
DATABASE_URL="<your-neon-url>" npx prisma db seed
```

### Step 6: Verify

- Visit https://api.konma.store — should return a response (or 404 for root)
- Test: `curl https://api.konma.store/auth/login` — should return 401 or method not allowed
- Check Railway logs for startup messages

---

## Part 4: Update Backend Code for Production Domain

Before deploying, update these in your `.env` (local) and Railway env vars:

```
FRONTEND_URL=https://konma.store
MAILERSEND_FROM_EMAIL=noreply@konma.store
```

The backend CORS is already configured to read `FRONTEND_URL`, so no code changes needed.

---

## Part 5: Post-Deployment Checklist

### Verify Cloudflare is Active
```bash
curl -I https://konma.store
# Look for: cf-ray header, server: cloudflare

curl -I https://api.konma.store
# Look for: cf-ray header, server: cloudflare
```

### Verify Frontend
- [ ] https://konma.store loads
- [ ] https://www.konma.store redirects to https://konma.store
- [ ] Login page renders
- [ ] API calls from frontend reach https://api.konma.store (check Network tab)

### Verify Backend
- [ ] https://api.konma.store responds
- [ ] Login works (POST /auth/login)
- [ ] Protected endpoints return 401 without token
- [ ] Protected endpoints return data with valid token

### Verify Public Endpoints
- [ ] https://konma.store/menu — public menu loads
- [ ] https://konma.store/events — public events load
- [ ] Feedback submission works
- [ ] Event booking works

### Verify Security
- [ ] `curl https://api.konma.store/.env` → blocked by WAF (403)
- [ ] `curl https://api.konma.store/wp-admin` → blocked (403)
- [ ] Rate limiting works: rapid requests get 429
- [ ] HTTPS enforced: http://konma.store redirects to https://

### Verify Email
- [ ] Forgot password sends email from noreply@konma.store
- [ ] New user setup email works

---

## Troubleshooting

**"Too many redirects" error:**
→ Cloudflare SSL mode must be "Full (Strict)", not "Flexible"

**CORS errors from frontend:**
→ Verify `FRONTEND_URL=https://konma.store` in Railway env vars
→ The backend reads this for CORS origin

**Vercel domain not verifying:**
→ Make sure Cloudflare proxy is OFF for @ and www records during verification
→ Turn proxy ON after verification succeeds

**Railway domain not verifying:**
→ Make sure CNAME for `api` points to your Railway app URL
→ Proxy can be ON for api subdomain

**API rate limiter treating all users as one IP:**
→ Backend has `trust proxy` enabled (already done in main.ts)
→ Cloudflare passes real IP via CF-Connecting-IP header

**Redis connection timeout on Railway:**
→ Check UPSTASH_REDIS_URL is the TCP URL (rediss://...), not REST URL (https://...)
→ Railway can reach Upstash — this only fails on local networks that block port 6379

**Managed Challenge blocking API fetch() calls:**
→ WAF Rule 2 and 3 should only match browser-facing paths
→ Frontend API calls use Authorization header, not cookies — they won't trigger challenges
→ If needed, add exception: `http.request.headers["authorization"] is not empty` → Skip

**Build fails on Railway:**
→ Make sure Root Directory is set to `backend`
→ Check that `npm run build` works locally first
