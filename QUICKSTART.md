# 🚀 Quick Start Guide - Si Crypto Platform

Get up and running in **10 minutes** with the FREE stack!

## ✅ Prerequisites

- ✅ Node.js v20+ (You have v24.13.0)
- ✅ pnpm (You have it installed)
- ⏳ Docker Desktop (Download if not installed)

## 📦 Step 1: Install Docker Desktop (5 minutes)

If you don't have Docker installed:

1. Download: https://www.docker.com/products/docker-desktop/
2. Install and start Docker Desktop
3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

## 🔧 Step 2: Setup Environment (2 minutes)

1. **Copy environment template**:
   ```bash
   cd apps/backend
   cp .env.example .env
   ```

2. **Generate JWT secrets** (run in terminal):
   ```bash
   # Generate JWT_SECRET
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

   # Generate JWT_REFRESH_SECRET
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

   # Generate MASTER_SEED_PASSWORD
   node -e "console.log('MASTER_SEED_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
   ```

3. **Update `.env` file** with the generated secrets

## 🐳 Step 3: Start Database (1 minute)

```bash
# From project root
docker-compose up -d
```

This starts:
- ✅ PostgreSQL on port 5432
- ✅ Redis on port 6379

Check status:
```bash
docker-compose ps
```

Expected output:
```
NAME            STATUS
si-postgres     Up
si-redis        Up
```

## 📊 Step 4: Initialize Database (1 minute)

```bash
# Install dependencies (if not done)
pnpm install

# Database schema is auto-loaded by docker-compose
# Check if database is ready:
docker exec si-postgres psql -U si_user -d si_crypto -c "\dt"
```

You should see all the tables listed.

## 🎯 Step 5: Start Backend (30 seconds)

```bash
cd apps/backend
pnpm run start:dev
```

Expected output:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG Listening on http://localhost:3000
```

Test API:
```bash
curl http://localhost:3000
```

## 📱 Step 6: Start Mobile App (30 seconds)

**In a new terminal:**

```bash
cd apps/mobile
pnpm start
```

Then press:
- `a` for Android emulator
- `i` for iOS simulator
- `w` for web browser

## ✨ You're Done!

Your Si Crypto Platform is now running:

- 🔹 **Backend API**: http://localhost:3000
- 🔹 **Mobile App**: Expo Dev Server
- 🔹 **PostgreSQL**: localhost:5432
- 🔹 **Redis**: localhost:6379

### Optional: Database GUI Tools

View database with pgAdmin:
```bash
docker-compose --profile tools up -d pgadmin
```

Access at: http://localhost:5050
- Email: admin@si-crypto.local
- Password: admin

View Redis with Redis Commander:
```bash
docker-compose --profile tools up -d redis-commander
```

Access at: http://localhost:8081

---

## 🆓 Step 7: Sign Up for FREE Services (Optional)

These are needed for full functionality:

### Immediate (Required):
1. **Infura** (Ethereum): https://www.infura.io/
   - Sign up → Create Project → Copy Project ID
   - Add to `.env`: `INFURA_PROJECT_ID=...`

2. **Resend** (Email): https://resend.com/
   - Sign up → Create API Key
   - Add to `.env`: `RESEND_API_KEY=re_...`

3. **Firebase** (Push Notifications): https://console.firebase.google.com/
   - Create Project → Add Android/iOS app
   - Download config files → Add to mobile app

### Later (When Needed):
- **CoinGecko**: Works without API key (free tier)
- **BlockCypher**: Works without signup for Bitcoin
- **Binance WebSocket**: No signup required

---

## 🧪 Test Everything

### Test Backend Health:
```bash
curl http://localhost:3000/health
```

### Test Database Connection:
```bash
docker exec si-postgres psql -U si_user -d si_crypto -c "SELECT current_database();"
```

### Test Redis:
```bash
docker exec si-redis redis-cli -a si_redis_password_dev ping
```

Expected: `PONG`

---

## 🛑 Stop Everything

```bash
# Stop Docker containers
docker-compose down

# Keep data (databases persist)
docker-compose down

# Remove everything including data
docker-compose down -v
```

---

## 📚 Next Steps

1. **Read Documentation**:
   - [README.md](README.md) - Project overview
   - [FREE_SERVICES_ALTERNATIVE.md](docs/FREE_SERVICES_ALTERNATIVE.md) - Free services guide
   - [Implementation Plan](.claude/plans/glimmering-orbiting-shore.md) - Full 18-week plan

2. **Week 2 Tasks** (Next):
   - Bitcoin wallet generation
   - Ethereum wallet integration
   - Transaction signing

3. **Test the Shared Packages**:
   ```bash
   # Build shared packages
   pnpm --filter @si/shared-types build
   pnpm --filter @si/shared-utils build
   ```

---

## ❓ Troubleshooting

### Docker containers won't start
```bash
# Check if Docker is running
docker info

# Check port conflicts
netstat -an | findstr "5432"  # PostgreSQL
netstat -an | findstr "6379"  # Redis
```

### Database connection error
```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

### pnpm install fails
```bash
# Clear cache
pnpm store prune

# Reinstall
rm -rf node_modules
pnpm install
```

---

## 💡 Tips

1. **Use Docker Compose** for all databases (don't install locally)
2. **Keep .env secure** - never commit to Git
3. **Use testnet mode** for development (`TESTNET_MODE=true`)
4. **Start small** - add features incrementally
5. **Check logs** if something fails:
   ```bash
   docker-compose logs postgres
   docker-compose logs redis
   ```

---

**Total Setup Time**: ~10 minutes
**Total Cost**: $0
**You're ready to build! 🎉**
