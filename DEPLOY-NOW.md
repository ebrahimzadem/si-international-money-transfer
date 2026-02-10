# 🚀 Deploy Si Crypto Platform NOW - Quick Guide

**Estimated Time: 20 minutes**

## ✅ What You Have

- ✅ Complete Si Crypto Platform codebase
- ✅ Production-ready Docker setup
- ✅ Professional animated UI
- ✅ Generated production secrets
- ✅ Deployment documentation

---

## 📝 Before You Start

### 1. Configure Git (One-time)

```bash
# Open PowerShell/CMD in project directory
cd c:\Users\Vesta\OneDrive\Documents\Dev\si-hello-world

# Set your Git identity
git config user.email "your-email@gmail.com"
git config user.name "Your Name"

# Commit the code
git add .
git commit -m "Initial Si Crypto Platform - Production Ready"
```

### 2. Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `si-crypto-platform`
3. Make it **Private** (important for security)
4. Don't initialize with README (we have one)
5. Click "Create repository"

### 3. Push to GitHub

```bash
# Add GitHub remote (replace with YOUR repository URL)
git remote add origin https://github.com/YOUR_USERNAME/si-crypto-platform.git

# Push code
git branch -M main
git push -u origin main
```

---

## 🎯 Deploy to Railway (10 minutes)

### Step 1: Sign Up (2 min)

1. Go to: https://railway.app
2. Click "Login with GitHub"
3. Authorize Railway

### Step 2: Create Project (3 min)

1. Click "+ New Project"
2. Select "Deploy from GitHub repo"
3. Choose `si-crypto-platform`
4. Railway will automatically detect Docker and deploy

### Step 3: Add Databases (2 min)

**Add PostgreSQL:**
1. Click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway auto-creates `DATABASE_URL` variable

**Add Redis:**
1. Click "+ New" again
2. Select "Database" → "Add Redis"
3. Railway auto-creates `REDIS_URL` variable

### Step 4: Configure Environment (3 min)

**Click on your backend service → Settings → Variables**

**Add these (copy from secrets generated earlier):**

```env
# From the secrets you generated
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
SESSION_SECRET=<your-session-secret>
MASTER_SEED_PASSWORD=<your-master-seed-password>

# Application
NODE_ENV=production
APP_NAME=Si Crypto Platform

# Blockchain (get from Infura.io)
INFURA_PROJECT_ID=<sign-up-at-infura.io>
INFURA_PROJECT_SECRET=<from-infura>

# Email (get from Resend.com)
RESEND_API_KEY=<sign-up-at-resend.com>
EMAIL_FROM=Si Crypto <noreply@siapp.com>

# Security
CORS_ORIGIN=https://siapp.com,https://api.siapp.com
TESTNET_MODE=false

# Features
FEATURE_SWAPS_ENABLED=true
FEATURE_WITHDRAWALS_ENABLED=true
FEATURE_DEPOSITS_ENABLED=true
```

### Step 5: Deploy! 🚀

Railway automatically deploys when you save variables.

**Your API will be live at:**
```
https://your-app-name.up.railway.app
```

---

## 🌐 Add Custom Domain (5 minutes)

### Option 1: Buy Domain First

**Recommended: Namecheap**
1. Go to: https://www.namecheap.com
2. Search: `siapp.com` (or your preferred name)
3. Purchase domain ($8-12/year)

### Option 2: Use Railway's Free Subdomain

Railway gives you a free `.railway.app` subdomain!

### Configure Custom Domain in Railway

1. Go to your backend service → Settings → Domains
2. Click "Custom Domain"
3. Enter: `api.siapp.com`
4. Railway gives you a CNAME record

**In Namecheap DNS:**
```
Type    Host    Value                       TTL
CNAME   api     <railway-cname>            Automatic
```

**SSL is automatic!** Railway provides free HTTPS via Let's Encrypt.

---

## 🧪 Test Your Deployment

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

Edit `apps/mobile/src/services/api.ts`:

```typescript
const API_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.siapp.com';  // Your Railway URL
```

### 3. Test Authentication

```bash
# Register a test user
curl -X POST https://api.siapp.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }'

# Expected: JWT token returned
```

---

## 📊 Monitor Your App

### Railway Dashboard

**View Logs:**
1. Click on backend service
2. Go to "Logs" tab
3. Real-time logs appear

**View Metrics:**
1. Go to "Metrics" tab
2. See CPU, Memory, Network usage

### Set Up Alerts (Optional)

**Sentry (Error Tracking - FREE)**
1. Sign up: https://sentry.io
2. Create new project
3. Add to Railway variables:
   ```env
   SENTRY_ENABLED=true
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

---

## 💰 Cost Breakdown

### Railway Monthly Costs

| Service | Resources | Cost |
|---------|-----------|------|
| **Backend** | 1 vCPU, 512MB RAM | $10-15 |
| **PostgreSQL** | 1GB RAM, 10GB storage | $5-10 |
| **Redis** | 512MB RAM | $5 |
| **Total** | | **~$25/month** |

### Domain Cost

| Provider | Annual Cost |
|----------|-------------|
| Namecheap .com | $12/year ($1/month) |
| **Total First Year** | **~$26/month** |

---

## 🎓 Required Free Services

**Sign up for these (all FREE tiers):**

### 1. Infura (Ethereum Node)
- URL: https://www.infura.io/
- Why: Connect to Ethereum blockchain
- Limit: 100k requests/day (FREE)

**Steps:**
1. Sign up with email
2. Create new project
3. Copy Project ID and Secret
4. Add to Railway variables

### 2. Resend (Email Notifications)
- URL: https://resend.com/
- Why: Send transaction alerts
- Limit: 3,000 emails/month (FREE)

**Steps:**
1. Sign up with email
2. Create API key
3. Copy API key
4. Add to Railway variables

### 3. Firebase (Push Notifications)
- URL: https://console.firebase.google.com/
- Why: Mobile push notifications
- Limit: Unlimited (FREE forever)

**Steps:**
1. Create new project "si-crypto-app"
2. Add Android/iOS apps
3. Settings → Cloud Messaging → Copy Server Key
4. Add to Railway variables

---

## ✅ Deployment Checklist

- [ ] Git configured with your email/name
- [ ] Code pushed to GitHub (private repo)
- [ ] Railway account created
- [ ] Backend deployed on Railway
- [ ] PostgreSQL added
- [ ] Redis added
- [ ] Environment variables configured
- [ ] Infura account created & API key added
- [ ] Resend account created & API key added
- [ ] Domain purchased (optional)
- [ ] Custom domain configured (optional)
- [ ] Backend health check passes
- [ ] Mobile app updated with production URL
- [ ] Test registration works

---

## 🆘 Troubleshooting

### "Backend won't deploy"

```bash
# Check Railway logs
# Go to Railway dashboard → Backend service → Logs

# Common issues:
# 1. Missing environment variables
# 2. Docker build errors
# 3. Database connection failure
```

### "DATABASE_URL not found"

Make sure PostgreSQL plugin is added and connected to backend service.

### "CORS errors"

Update `CORS_ORIGIN` in Railway variables to include your domain.

---

## 🚀 Next Steps After Deployment

### 1. Mobile App Deployment

**iOS (App Store):**
```bash
cd apps/mobile
npx expo install expo-dev-client
eas build --platform ios
eas submit --platform ios
```

**Android (Play Store):**
```bash
eas build --platform android
eas submit --platform android
```

### 2. Marketing & Launch

- [ ] Create landing page (siapp.com)
- [ ] Set up social media (Twitter, LinkedIn)
- [ ] Write blog post announcement
- [ ] Submit to Product Hunt
- [ ] Reach out to crypto communities

### 3. Compliance (If needed)

- [ ] FinCEN MSB registration (US only)
- [ ] Terms of Service & Privacy Policy
- [ ] AML/KYC procedures
- [ ] Consult with crypto lawyer

---

## 🎉 Congratulations!

**Your Si Crypto Platform is live in production!**

**What you've built:**
- ✅ Professional React Native mobile app
- ✅ NestJS backend with custodial wallets
- ✅ PostgreSQL + Redis infrastructure
- ✅ Bitcoin & Ethereum support
- ✅ Real-time price feeds
- ✅ Secure authentication
- ✅ Production deployment

**Total time:** 18 weeks of work → **Deployed in 20 minutes!**

---

## 📚 Additional Resources

- **Full Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Implementation Plan:** [Plan File](C:\Users\Vesta\.claude\plans\glimmering-orbiting-shore.md)
- **Security Guide:** [docs/SECURITY.md](docs/SECURITY.md)
- **Firebase Setup:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)

---

## 💬 Support

**Questions?**
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Expo Docs: https://docs.expo.dev

**Need help?** Open an issue on GitHub or check DEPLOYMENT.md for detailed guides.

---

**🚀 Ready to launch your crypto platform!**

Next: [Marketing Strategy](LAUNCH.md)
