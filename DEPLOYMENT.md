# 🚀 Si Crypto Platform - Production Deployment Guide

This guide walks you through deploying the Si Crypto Platform to production with Railway and setting up a custom domain.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: Railway (Recommended)](#option-1-railway-recommended)
3. [Option 2: DigitalOcean](#option-2-digitalocean)
4. [Domain Setup](#domain-setup)
5. [SSL Certificates](#ssl-certificates)
6. [Post-Deployment](#post-deployment)

---

## Prerequisites

Before deploying, you need:

- ✅ GitHub account
- ✅ Domain name (recommended: Namecheap, $8-12/year)
- ✅ Infura account (FREE - for Ethereum)
- ✅ Resend account (FREE - for emails)
- ✅ Firebase project (FREE - for push notifications)

---

## Option 1: Railway (Recommended)

**Total Cost: ~$25-35/month**

### Why Railway?
- ✅ Zero DevOps - Railway manages everything
- ✅ Automatic deployments from GitHub
- ✅ Built-in PostgreSQL and Redis
- ✅ Free SSL certificates
- ✅ 99.9% uptime SLA

### Step 1: Push Code to GitHub

```bash
# Navigate to project
cd c:\Users\Vesta\OneDrive\Documents\Dev\si-hello-world

# Initialize Git (if not already)
git init

# Create .gitignore (if not exists)
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "node_modules/" >> .gitignore
echo "dist/" >> .gitignore

# Commit code
git add .
git commit -m "Initial Si Crypto Platform commit"

# Create GitHub repo and push
# Go to github.com and create a new repository named "si-crypto-platform"
git remote add origin https://github.com/YOUR_USERNAME/si-crypto-platform.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy Backend to Railway

1. **Create Railway Account:**
   - Go to: https://railway.app
   - Click "Login with GitHub"
   - Authorize Railway

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `si-crypto-platform` repository
   - Select the `apps/backend` directory

3. **Add PostgreSQL:**
   - In your Railway project
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway auto-creates `DATABASE_URL` environment variable

4. **Add Redis:**
   - Click "+ New" → "Database" → "Add Redis"
   - Railway auto-creates `REDIS_URL` environment variable

### Step 3: Configure Environment Variables

In Railway project settings, add these variables:

**Required Secrets (Generate these first):**

```bash
# Generate JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('MASTER_SEED_PASSWORD=' + require('crypto').randomBytes(64).toString('base64'))"
```

**In Railway Variables Tab, add:**

```env
# Application
NODE_ENV=production
APP_NAME=Si Crypto Platform
APP_URL=https://api.siapp.com

# JWT (use generated secrets from above)
JWT_SECRET=<your-generated-secret>
JWT_REFRESH_SECRET=<your-generated-secret>
SESSION_SECRET=<your-generated-secret>

# Master Seed (CRITICAL - Save this securely!)
MASTER_SEED_PASSWORD=<your-generated-password>

# Blockchain (Infura)
INFURA_PROJECT_ID=<get-from-infura.io>
INFURA_PROJECT_SECRET=<get-from-infura.io>

# Email (Resend)
RESEND_API_KEY=<get-from-resend.com>
EMAIL_FROM=Si Crypto <noreply@siapp.com>

# Firebase Push Notifications
FIREBASE_SERVER_KEY=<get-from-firebase>
FIREBASE_PROJECT_ID=si-crypto-app
FIREBASE_SENDER_ID=<get-from-firebase>

# Security
CORS_ORIGIN=https://siapp.com,https://www.siapp.com,https://api.siapp.com

# Blockchain Settings
TESTNET_MODE=false
USDC_CONTRACT_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Logging
LOG_LEVEL=info
SENTRY_ENABLED=false

# Feature Flags
FEATURE_SWAPS_ENABLED=true
FEATURE_WITHDRAWALS_ENABLED=true
FEATURE_DEPOSITS_ENABLED=true
```

### Step 4: Deploy

Railway automatically deploys when you push to GitHub!

```bash
# Make a change and push
git add .
git commit -m "Configure production environment"
git push

# Railway will automatically:
# 1. Build your Docker container
# 2. Deploy to production
# 3. Run database migrations
# 4. Start your app
```

**Check deployment:**
- Go to Railway dashboard
- Click on your backend service
- View "Deployments" tab
- Your API will be live at: `https://your-app.up.railway.app`

---

## Domain Setup

### Step 1: Buy Domain

**Recommended: Namecheap**

1. Go to: https://www.namecheap.com
2. Search for: `siapp.com` or `si-crypto.com`
3. Purchase domain ($8-12/year)

### Step 2: Configure DNS in Railway

**In Railway:**

1. Go to your backend service
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter: `api.siapp.com`
5. Railway provides a CNAME record

**In Namecheap (or your registrar):**

1. Go to Domain List → Manage → Advanced DNS
2. Add these records:

```
Type    Host    Value                           TTL
CNAME   api     <railway-cname-from-above>     Automatic
CNAME   www     <railway-cname-from-above>     Automatic
A       @       <your-mobile-app-server-ip>    Automatic
```

### Step 3: Update CORS in Railway

Update `CORS_ORIGIN` environment variable:

```env
CORS_ORIGIN=https://siapp.com,https://www.siapp.com,https://api.siapp.com
```

---

## SSL Certificates

**Railway provides FREE automatic SSL certificates via Let's Encrypt!**

No action needed - Railway handles:
- ✅ SSL certificate generation
- ✅ Automatic renewal
- ✅ HTTPS enforcement

Your API will be accessible at: `https://api.siapp.com`

---

## Option 2: DigitalOcean (More Control)

**Total Cost: ~$27/month**

### Step 1: Create Droplet

1. Sign up at: https://www.digitalocean.com
2. Create Droplet:
   - **Distribution:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($12/month - 2GB RAM, 1 vCPU)
   - **Region:** Closest to your users
   - **Authentication:** SSH keys (recommended)

### Step 2: Install Docker

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Deploy Application

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/si-crypto-platform.git
cd si-crypto-platform

# Create production .env file
cp apps/backend/.env.example apps/backend/.env
nano apps/backend/.env
# (Fill in production values)

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### Step 4: Configure Nginx (Reverse Proxy)

```bash
# Install Nginx
apt install nginx -y

# Create Nginx config
nano /etc/nginx/sites-available/siapp

# Add this configuration:
```

```nginx
server {
    listen 80;
    server_name api.siapp.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/siapp /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 5: Install SSL Certificate

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d api.siapp.com

# Certbot auto-configures HTTPS and renewal
```

---

## Post-Deployment Checklist

### 1. Test Backend API

```bash
# Health check
curl https://api.siapp.com/health

# Expected response:
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### 2. Update Mobile App

Update [apps/mobile/src/services/api.ts](apps/mobile/src/services/api.ts):

```typescript
const API_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.siapp.com';
```

### 3. Set Up Monitoring

**Option A: Railway (Built-in)**
- View logs in Railway dashboard
- Set up log alerts

**Option B: Sentry (Error Tracking)**

1. Sign up at: https://sentry.io (FREE tier)
2. Create new project
3. Add to Railway variables:

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### 4. Database Backups

**Railway:**
- Automatic daily backups included
- View in PostgreSQL plugin settings

**DigitalOcean:**
```bash
# Set up daily backup cron job
crontab -e

# Add this line (daily backup at 3 AM):
0 3 * * * docker exec si-postgres pg_dump -U postgres si_crypto > /backup/si_$(date +\%Y\%m\%d).sql
```

### 5. Security Hardening

**Enable Firewall (DigitalOcean):**
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

**Update secrets regularly:**
- Rotate JWT secrets every 90 days
- Never commit secrets to Git
- Use environment variables only

---

## Mobile App Deployment

### iOS (App Store)

1. **Prerequisites:**
   - Apple Developer Account ($99/year)
   - Mac with Xcode

2. **Build:**
```bash
cd apps/mobile
eas build --platform ios --profile production
```

3. **Submit:**
```bash
eas submit --platform ios
```

### Android (Play Store)

1. **Prerequisites:**
   - Google Play Developer Account ($25 one-time)

2. **Build:**
```bash
cd apps/mobile
eas build --platform android --profile production
```

3. **Submit:**
```bash
eas submit --platform android
```

---

## Cost Summary

### Railway (Recommended)

| Service | Cost |
|---------|------|
| Backend API | $10-15/month |
| PostgreSQL | $5-10/month |
| Redis | $5/month |
| **Subtotal** | **~$25/month** |
| Domain (Namecheap) | $1/month ($12/year) |
| **Total** | **~$26/month** |

### DigitalOcean

| Service | Cost |
|---------|------|
| Droplet (2GB) | $12/month |
| PostgreSQL Managed | $15/month (optional) |
| Redis (self-hosted) | $0 |
| **Subtotal** | **~$27/month** |
| Domain | $1/month |
| **Total** | **~$28/month** |

---

## Support & Resources

- **Railway Docs:** https://docs.railway.app
- **DigitalOcean Tutorials:** https://www.digitalocean.com/community/tutorials
- **Let's Encrypt:** https://letsencrypt.org
- **Expo EAS:** https://docs.expo.dev/eas

---

## Troubleshooting

### Backend won't start

```bash
# Check Railway logs
railway logs

# Or DigitalOcean
docker-compose logs backend
```

### Database connection error

- Verify `DATABASE_URL` in Railway variables
- Check if PostgreSQL plugin is running
- Ensure firewall allows connections

### SSL certificate issues

```bash
# Railway: Automatic - contact support if issues

# DigitalOcean: Renew manually
certbot renew
```

---

**🎉 Your Si Crypto Platform is now live in production!**

Next: [Marketing & Launch](LAUNCH.md)
