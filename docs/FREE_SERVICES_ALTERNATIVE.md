# FREE Alternative Services Setup (Zero Cost MVP)

This guide provides **100% free alternatives** to paid services for building the Si Crypto Platform MVP without any monthly costs.

## 🆓 Free Service Stack

| Original Service | Free Alternative | Limitations |
|------------------|------------------|-------------|
| Alchemy ($200/mo) | Infura Free Tier | 100k requests/day |
| Blockchair ($500/mo) | BlockCypher Free | 200 requests/hour |
| AWS KMS ($50/mo) | Self-hosted encryption | You manage security |
| Sumsub (pay-per-use) | Manual KYC | Manual review process |
| MoonPay (4.5% fee) | Skip for MVP | Users deposit from external wallets |
| CoinGecko ($130/mo) | CoinGecko Free | 50 calls/minute |
| SendGrid ($20/mo) | Resend Free | 3k emails/month |
| Firebase | Firebase Free | Already free! |

**Total Cost: $0/month** 🎉

---

## 1. 🔗 Blockchain Nodes (FREE)

### Infura - Ethereum (FREE)

**Purpose**: Ethereum blockchain access

**Free Tier**:
- 100,000 requests/day
- WebSocket support
- Mainnet + Testnets
- No credit card required

**Setup**:
```bash
# Sign up
https://www.infura.io/

# Get your project ID
PROJECT_ID=your_project_id_here

# URLs
INFURA_MAINNET_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
INFURA_SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

**Alternative**: **Ankr** (https://www.ankr.com/)
- 500M requests/month free
- Multi-chain support
- No signup required for public endpoints

**Public Endpoints** (No signup needed):
```bash
# Ethereum Mainnet
https://eth.llamarpc.com
https://rpc.ankr.com/eth

# Ethereum Sepolia Testnet
https://rpc.ankr.com/eth_sepolia
```

---

### BlockCypher - Bitcoin (FREE)

**Purpose**: Bitcoin blockchain data

**Free Tier**:
- 200 requests/hour (4,800/day)
- Transaction webhooks
- Address balance queries
- No credit card required

**Setup**:
```bash
# Sign up (optional, higher limits with account)
https://www.blockcypher.com/

# API Base URL
BLOCKCYPHER_BASE_URL=https://api.blockcypher.com/v1/btc/main

# Get address balance (no API key needed)
curl https://api.blockcypher.com/v1/btc/main/addrs/ADDRESS/balance
```

**Alternative**: **Blockchain.info API** (FREE)
- Unlimited requests
- No signup required
```bash
# Get address balance
https://blockchain.info/balance?active=ADDRESS

# Get transaction
https://blockchain.info/rawtx/TX_HASH
```

**Alternative 2**: **Blockstream Esplora** (FREE)
- Open source
- Self-hostable
- Public instance: https://blockstream.info/api/
```bash
# Get address info
https://blockstream.info/api/address/ADDRESS

# Get UTXO
https://blockstream.info/api/address/ADDRESS/utxo
```

---

## 2. 🔐 Key Management (FREE - Self-Hosted)

### Option A: Node.js Crypto Module (Built-in)

**Purpose**: Encrypt master seed locally

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encrypt master seed
function encryptMasterSeed(seed: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(seed, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Return: salt + iv + authTag + encrypted
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' +
         authTag.toString('hex') + ':' + encrypted;
}

// Decrypt master seed
function decryptMasterSeed(encrypted: string, password: string): string {
  const [saltHex, ivHex, authTagHex, encryptedData] = encrypted.split(':');

  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = scryptSync(password, salt, 32);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Environment Variables**:
```bash
MASTER_SEED_PASSWORD=your-super-strong-password-min-32-chars
ENCRYPTED_MASTER_SEED=stored-in-env-or-secrets-file
```

**Security Notes**:
- ⚠️ Store password in environment variable (never in code)
- ⚠️ Use strong password (32+ characters)
- ⚠️ For production, upgrade to AWS KMS or HashiCorp Vault

---

### Option B: HashiCorp Vault (FREE - Self-Hosted)

**Purpose**: Enterprise-grade secret management

**Setup** (Docker):
```bash
# Run Vault in dev mode (for development only)
docker run -d --name=vault -p 8200:8200 \
  -e 'VAULT_DEV_ROOT_TOKEN_ID=myroot' \
  -e 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200' \
  vault:latest

# Access: http://localhost:8200
# Token: myroot
```

**Usage**:
```typescript
import * as vault from 'node-vault';

const client = vault({
  endpoint: 'http://localhost:8200',
  token: process.env.VAULT_TOKEN,
});

// Store master seed
await client.write('secret/data/master-seed', {
  data: { seed: 'your-mnemonic-phrase' }
});

// Retrieve master seed
const result = await client.read('secret/data/master-seed');
const seed = result.data.data.seed;
```

**Production**: Run Vault on dedicated server with proper security

---

## 3. 💰 Price Feeds (FREE)

### CoinGecko Free Tier

**Free Tier**:
- 10-50 calls/minute
- Historical data
- 13,000+ coins
- No credit card required

**Setup**:
```bash
# No API key needed for free tier
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3

# Get prices (no auth)
curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin&vs_currencies=usd"
```

**Response**:
```json
{
  "bitcoin": { "usd": 45000 },
  "ethereum": { "usd": 2500 },
  "usd-coin": { "usd": 1.0 }
}
```

**Rate Limit**: 50 calls/minute (enough for MVP)

---

### Binance Public API (FREE)

**Purpose**: Real-time WebSocket price updates

**Setup** (No signup required):
```typescript
import WebSocket from 'ws';

// Connect to Binance WebSocket
const ws = new WebSocket('wss://stream.binance.com:9443/stream');

// Subscribe to multiple symbols
ws.on('open', () => {
  ws.send(JSON.stringify({
    method: 'SUBSCRIBE',
    params: ['btcusdt@ticker', 'ethusdt@ticker'],
    id: 1
  }));
});

// Receive real-time prices
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.data) {
    console.log('Symbol:', msg.data.s);
    console.log('Price:', msg.data.c);
  }
});
```

**Alternative**: **CryptoCompare** (FREE)
- 100k calls/month free
- WebSocket available
- https://min-api.cryptocompare.com/

---

## 4. 📧 Email Notifications (FREE)

### Resend - Email API (FREE)

**Free Tier**:
- 3,000 emails/month
- 100 emails/day
- Modern API
- No credit card required

**Setup**:
```bash
# Sign up
https://resend.com/

# Install
npm install resend

# Get API key (free tier)
RESEND_API_KEY=re_...
```

**Usage**:
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Si Crypto <noreply@yourdomain.com>',
  to: 'user@example.com',
  subject: 'Withdrawal Completed',
  html: '<p>Your withdrawal of 0.01 BTC has been completed.</p>'
});
```

**Alternative**: **SendGrid Free Tier**
- 100 emails/day
- https://sendgrid.com/

---

### Gmail SMTP (FREE)

**Purpose**: Send emails via Gmail (development only)

**Setup**:
```typescript
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD // Use app password, not regular password
  }
});

await transporter.sendMail({
  from: 'yourapp@gmail.com',
  to: 'user@example.com',
  subject: 'Test Email',
  html: '<p>Hello from Si Crypto</p>'
});
```

**Limits**: 500 emails/day

---

## 5. 🔔 Push Notifications (FREE)

### Firebase Cloud Messaging (Already Free!)

**Setup**:
```bash
# Create Firebase project (free forever)
https://console.firebase.google.com/

# Add to React Native
npx expo install expo-notifications
```

**Usage**:
```typescript
import * as Notifications from 'expo-notifications';

// Send notification
await fetch('https://fcm.googleapis.com/fcm/send', {
  method: 'POST',
  headers: {
    'Authorization': `key=${process.env.FIREBASE_SERVER_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: userDeviceToken,
    notification: {
      title: 'Deposit Received',
      body: 'You received 0.01 BTC'
    }
  })
});
```

**Alternative**: **OneSignal** (FREE)
- Unlimited push notifications
- Multi-platform
- https://onesignal.com/

---

## 6. 🗄️ Database & Cache (FREE)

### PostgreSQL (Self-Hosted - Docker)

**Setup**:
```bash
# Run PostgreSQL in Docker
docker run -d \
  --name si-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=si_crypto \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:15-alpine

# Connection string
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/si_crypto
```

**Cloud Alternative (FREE Tier)**:
- **Neon** (https://neon.tech/) - 0.5 GB storage, serverless Postgres
- **Supabase** (https://supabase.com/) - 500 MB database, 2 GB bandwidth
- **ElephantSQL** (https://www.elephantsql.com/) - 20 MB free tier

---

### Redis (Self-Hosted - Docker)

**Setup**:
```bash
# Run Redis in Docker
docker run -d \
  --name si-redis \
  -p 6379:6379 \
  redis:7-alpine

# Connection
REDIS_URL=redis://localhost:6379
```

**Cloud Alternative (FREE Tier)**:
- **Upstash** (https://upstash.com/) - 10k commands/day
- **Redis Cloud** (https://redis.com/try-free/) - 30 MB free

---

## 7. 🔍 KYC Alternative (FREE for MVP)

### Option A: Manual Verification

**Process**:
1. User uploads ID photo via app
2. Store in local storage or Supabase Storage (free)
3. Admin manually reviews (you!)
4. Approve/reject in database

**Implementation**:
```sql
-- Users table already has kyc_status
UPDATE users
SET kyc_status = 'verified', kyc_level = 2
WHERE id = 'user-id';
```

**Tools**:
- **Supabase Storage** (FREE) - 1 GB file storage
- **AWS S3 Free Tier** - 5 GB for 12 months

---

### Option B: Skip KYC for MVP

**Approach**:
- Set low limits ($100/day) without KYC
- Manual review for larger amounts
- Add KYC provider later when you have budget

---

## 8. 💳 On-Ramp Alternative (FREE)

### Skip On-Ramp for MVP

**Approach**:
- Users deposit crypto from external wallets (MetaMask, Coinbase, etc.)
- No need for MoonPay integration
- Focus on wallet and trading features first

**Benefits**:
- Zero cost
- Simpler implementation
- Crypto-native users already have wallets

**Add Later**: When you have revenue and users

---

## 9. 🎨 Development Tools (FREE)

### Docker Desktop (FREE)

**Purpose**: Run PostgreSQL, Redis locally

**Download**: https://www.docker.com/products/docker-desktop/

**Setup**:
```bash
# Create docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: si_crypto
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres-data:
```

**Run**:
```bash
docker-compose up -d
```

---

## 📋 FREE Setup Checklist

### Immediate Setup (Today)

- [ ] Sign up for **Infura** (Ethereum) - FREE
- [ ] Use **BlockCypher** (Bitcoin) - No signup needed
- [ ] Sign up for **CoinGecko** - No API key needed for free tier
- [ ] Sign up for **Resend** (Email) - FREE 3k/month
- [ ] Create **Firebase** project (Push) - FREE forever
- [ ] Install **Docker Desktop** - FREE
- [ ] Run PostgreSQL + Redis in Docker - FREE

### Environment Variables (FREE Stack)

```bash
# Blockchain Nodes (FREE)
INFURA_PROJECT_ID=your_project_id
INFURA_MAINNET_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
BLOCKCYPHER_BASE_URL=https://api.blockcypher.com/v1/btc/main

# Key Management (Self-hosted)
MASTER_SEED_PASSWORD=your-super-strong-password-32-chars-minimum
ENCRYPTED_MASTER_SEED=will-be-generated-on-first-run

# Price Feeds (FREE)
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
BINANCE_WS_URL=wss://stream.binance.com:9443/stream

# Email (FREE)
RESEND_API_KEY=re_your_api_key

# Push Notifications (FREE)
FIREBASE_SERVER_KEY=your_server_key
FIREBASE_PROJECT_ID=si-crypto

# Database (Local Docker - FREE)
DATABASE_URL=postgresql://postgres:password@localhost:5432/si_crypto
REDIS_URL=redis://localhost:6379

# App Config
NODE_ENV=development
PORT=3000
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
```

---

## 💰 Cost Comparison

| Service Category | Paid Option | FREE Option | Savings |
|------------------|-------------|-------------|---------|
| Ethereum Node | Alchemy $200 | Infura Free | $200/mo |
| Bitcoin API | Blockchair $500 | BlockCypher Free | $500/mo |
| Key Management | AWS KMS $50 | Self-hosted | $50/mo |
| Price Feeds | CoinGecko Pro $130 | CoinGecko Free | $130/mo |
| Email | SendGrid $20 | Resend Free | $20/mo |
| Database | AWS RDS $50 | Docker Free | $50/mo |
| **TOTAL** | **$950/mo** | **$0/mo** | **$950/mo** |

---

## ⚠️ Limitations to Know

1. **Rate Limits**:
   - Infura: 100k requests/day (plenty for MVP)
   - BlockCypher: 200 requests/hour (may need caching)
   - CoinGecko: 50 calls/minute (cache aggressively)

2. **Security**:
   - Self-hosted encryption is YOUR responsibility
   - Upgrade to AWS KMS when handling real user funds

3. **Reliability**:
   - Free tiers may have downtime
   - No SLA guarantees
   - Keep backup providers

4. **Scalability**:
   - Plan to upgrade when you hit limits
   - Free tiers good for 100-1000 users

---

## 🚀 Upgrade Path (When You Have Revenue)

**Month 1-3 (MVP)**: Use all free services
**Month 4-6 (First Users)**: Add Alchemy Pro ($200) for reliability
**Month 7-12 (Growing)**: Add AWS KMS ($50) for security
**Year 2**: Upgrade to paid tiers as needed

---

## 📞 Free Support

- **Infura**: https://www.infura.io/docs
- **BlockCypher**: https://www.blockcypher.com/dev/
- **CoinGecko**: https://www.coingecko.com/en/api/documentation
- **Resend**: https://resend.com/docs
- **Firebase**: https://firebase.google.com/support

---

**Last Updated**: February 2026
**Total Monthly Cost**: $0 💰
**Perfect for**: MVP, Development, Testing
