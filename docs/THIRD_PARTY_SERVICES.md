# Third-Party Services Setup Guide

This document lists all external services required for the Si Crypto Platform MVP. Services are listed in order of priority for signup and setup.

## 🚨 Critical Services (Week 1-2 Setup)

### 1. Alchemy - Ethereum Node Provider ⚡ HIGH PRIORITY

**Purpose**: Ethereum blockchain node access, webhooks for deposits, gas estimation

**Signup**: https://www.alchemy.com/

**Plan Needed**: Growth Plan ($200/month)
- 300M compute units/month
- Enhanced APIs
- WebSocket support
- Deposit webhooks

**Setup Steps**:
1. Create account at alchemy.com
2. Create new app: "Si Crypto - Production"
3. Select "Ethereum" → "Mainnet"
4. Get API key from dashboard
5. Set up webhook endpoints for deposit detection
6. Add testnet app for development: "Si Crypto - Sepolia"

**Environment Variables**:
```bash
ALCHEMY_API_KEY=your_api_key_here
ALCHEMY_WEBHOOK_SECRET=your_webhook_secret
ALCHEMY_MAINNET_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

**Documentation**: https://docs.alchemy.com/

**Estimated Setup Time**: 1-2 days (account approval + integration)

---

### 2. Blockchair - Bitcoin API ⚡ HIGH PRIORITY

**Purpose**: Bitcoin blockchain data, transaction monitoring, address balance queries

**Signup**: https://blockchair.com/api

**Plan Needed**: Professional Plan ($499/month)
- 100,000 requests/day
- Transaction webhooks
- Real-time updates
- Historical data

**Setup Steps**:
1. Go to blockchair.com/api/plans
2. Purchase Professional plan
3. Get API key from dashboard
4. Test API: `https://api.blockchair.com/bitcoin/dashboards/address/{address}?key=YOUR_KEY`

**Environment Variables**:
```bash
BLOCKCHAIR_API_KEY=your_api_key_here
BLOCKCHAIR_BASE_URL=https://api.blockchair.com
```

**Documentation**: https://blockchair.com/api/docs

**Estimated Setup Time**: 1 day

---

### 3. AWS Account + KMS ⚡ CRITICAL

**Purpose**: Master seed encryption, transaction signing, key management

**Signup**: https://aws.amazon.com/

**Services Needed**:
- **AWS KMS** - Key Management Service
- **AWS IAM** - Identity and Access Management
- **AWS Secrets Manager** (optional, for additional secrets)

**Setup Steps**:
1. Create AWS account
2. Enable billing alerts
3. Create IAM user for Si backend with programmatic access
4. Create KMS key in your region:
   - Go to KMS → Create Key
   - Key type: Symmetric
   - Key usage: Encrypt and decrypt
   - Alias: "si-master-seed-key"
   - Key administrators: Add your IAM user
   - Key users: Add backend service IAM user/role
5. Note the Key ID and ARN

**IAM Policy** (attach to backend service):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID"
    }
  ]
}
```

**Environment Variables**:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_KMS_KEY_ID=your_kms_key_id
```

**Documentation**: https://docs.aws.amazon.com/kms/

**Estimated Setup Time**: 1-2 days

**Monthly Cost**: ~$50 (KMS $1/month + API calls ~$0.03/10k)

---

## 🔐 KYC & Compliance (Week 2-3 Setup)

### 4. Sumsub - KYC Verification ⚡ HIGH PRIORITY

**Purpose**: Identity verification, document upload, liveness check, AML screening

**Signup**: https://sumsub.com/

**Plan Needed**: Pay-as-you-go or Growth plan
- $0.50-2.00 per verification (depending on region)
- API access
- Webhook callbacks
- React Native SDK

**Setup Steps**:
1. Sign up at sumsub.com
2. Complete onboarding questionnaire
3. Configure verification levels:
   - Level 1 (Basic): ID document + selfie ($1k/day limit)
   - Level 2 (Full): ID + address proof ($10k/day)
   - Level 3 (Enhanced): Full + source of funds ($100k/day)
4. Get API token and secret from dashboard
5. Set up webhook endpoint for status updates
6. Download React Native SDK

**Environment Variables**:
```bash
SUMSUB_APP_TOKEN=your_app_token
SUMSUB_SECRET_KEY=your_secret_key
SUMSUB_BASE_URL=https://api.sumsub.com
SUMSUB_WEBHOOK_SECRET=your_webhook_secret
```

**Documentation**: https://developers.sumsub.com/

**Estimated Setup Time**: 3-5 days (account review + integration)

---

### 5. Chainalysis Reactor - AML Screening (Optional for MVP)

**Purpose**: Blockchain address risk scoring, sanctions screening

**Signup**: https://www.chainalysis.com/

**Plan Needed**: Reactor Startup ($1,000-5,000/month)
- Address risk scoring
- OFAC sanctions screening
- Transaction monitoring
- API access

**Setup Steps**:
1. Contact Chainalysis sales
2. Request startup pricing
3. Complete compliance questionnaire
4. Get API credentials
5. Integrate risk scoring into withdrawal flow

**When to Add**: When processing >$100k/day in transactions

**Environment Variables**:
```bash
CHAINALYSIS_API_KEY=your_api_key
CHAINALYSIS_BASE_URL=https://api.chainalysis.com
```

**Documentation**: https://docs.chainalysis.com/

**Estimated Setup Time**: 2-4 weeks (sales + integration)

**Note**: Can be deferred to Phase 2 if budget constrained

---

## 💵 On/Off Ramp Services (Week 3-4 Setup)

### 6. MoonPay - Buy Crypto (On-Ramp) ⚡ HIGH PRIORITY

**Purpose**: Allow users to buy crypto with credit card or bank transfer

**Signup**: https://www.moonpay.com/

**Plan Needed**: Contact sales for business account
- 4.5% transaction fee (paid by user)
- React Native SDK
- Webhook callbacks
- Sandbox for testing

**Setup Steps**:
1. Apply for business account at moonpay.com
2. Complete KYB (Know Your Business) verification
3. Provide business documents:
   - Business registration
   - Proof of address
   - Banking details
4. Get approved (1-2 weeks)
5. Get API keys: Publishable key + Secret key
6. Access sandbox environment
7. Install React Native SDK
8. Configure webhook endpoint

**Environment Variables**:
```bash
MOONPAY_PUBLISHABLE_KEY=pk_test_...
MOONPAY_SECRET_KEY=sk_test_...
MOONPAY_BASE_URL=https://api.moonpay.com
MOONPAY_WEBHOOK_SECRET=your_webhook_secret
MOONPAY_WIDGET_URL=https://buy.moonpay.com
```

**React Native Integration**:
```bash
npm install @moonpay/moonpay-react-native-sdk
```

**Documentation**: https://docs.moonpay.com/

**Estimated Setup Time**: 1-2 weeks (approval process)

---

## 📊 Price Data & Market Info (Week 2-3 Setup)

### 7. CoinGecko API - Price Feeds ⚡ MEDIUM PRIORITY

**Purpose**: Real-time crypto prices, historical data, market cap, 24h volume

**Signup**: https://www.coingecko.com/en/api

**Plan Needed**: Analyst Plan ($130/month)
- 10,000 calls/month
- Rate limit: 500 calls/min
- Historical data
- No credit card branding

**Setup Steps**:
1. Sign up at coingecko.com/en/api
2. Subscribe to Analyst plan
3. Get API key from dashboard
4. Test endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin&vs_currencies=usd`

**Environment Variables**:
```bash
COINGECKO_API_KEY=your_api_key
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
```

**Free Tier Alternative**: Free tier available (50 calls/min) for development

**Documentation**: https://docs.coingecko.com/

**Estimated Setup Time**: 1 day

---

### 8. Binance Public API - Real-Time Prices (Free)

**Purpose**: WebSocket for live price updates (complement to CoinGecko)

**Signup**: Not required (public API)

**Setup Steps**:
1. No signup needed
2. Use WebSocket: `wss://stream.binance.com:9443/ws`
3. Subscribe to streams:
   - `btcusdt@ticker` for Bitcoin
   - `ethusdt@ticker` for Ethereum
   - `usdcusdt@ticker` for USDC

**Implementation**:
```typescript
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
ws.on('message', (data) => {
  const ticker = JSON.parse(data);
  console.log('BTC Price:', ticker.c); // Current price
});
```

**Documentation**: https://binance-docs.github.io/apidocs/spot/en/

**Estimated Setup Time**: 1 hour

---

## 📧 Communication Services (Week 3-4 Setup)

### 9. SendGrid - Email Notifications

**Purpose**: Transactional emails (verification, withdrawal alerts, security notifications)

**Signup**: https://sendgrid.com/

**Plan Needed**: Essentials Plan ($20/month)
- 100 emails/day on free tier
- Essentials: 50,000 emails/month

**Setup Steps**:
1. Sign up at sendgrid.com
2. Verify your domain
3. Create API key
4. Set up email templates:
   - Email verification
   - Password reset
   - Withdrawal initiated
   - Withdrawal completed
   - Security alert
5. Configure SPF and DKIM records

**Environment Variables**:
```bash
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@si-crypto.com
SENDGRID_FROM_NAME=Si Crypto
```

**Documentation**: https://docs.sendgrid.com/

**Estimated Setup Time**: 1-2 days

---

### 10. Firebase Cloud Messaging - Push Notifications (Free)

**Purpose**: Push notifications for mobile app (deposit received, withdrawal sent, etc.)

**Signup**: https://firebase.google.com/

**Plan Needed**: Free tier (unlimited notifications)

**Setup Steps**:
1. Create Firebase project
2. Add Android app:
   - Download `google-services.json`
   - Add to `apps/mobile/android/app/`
3. Add iOS app:
   - Download `GoogleService-Info.plist`
   - Add to `apps/mobile/ios/`
4. Get Server Key for backend
5. Install Expo notification libraries

**Environment Variables**:
```bash
FIREBASE_SERVER_KEY=your_server_key
FIREBASE_PROJECT_ID=si-crypto-app
```

**React Native Setup**:
```bash
npx expo install expo-notifications expo-device expo-constants
```

**Documentation**: https://firebase.google.com/docs/cloud-messaging

**Estimated Setup Time**: 1 day

---

### 11. Twilio - SMS (Optional)

**Purpose**: SMS for 2FA backup, security alerts

**Signup**: https://www.twilio.com/

**Plan Needed**: Pay-as-you-go
- $0.0075 per SMS (US)
- $15 starting credit

**Setup Steps**:
1. Sign up at twilio.com
2. Get phone number
3. Get Account SID and Auth Token
4. Verify your business (required for production)

**Environment Variables**:
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**When to Add**: When enabling SMS 2FA (Week 5+)

**Documentation**: https://www.twilio.com/docs/

---

## 📋 Signup Priority & Timeline

### Week 1 (Immediate)
- ✅ AWS Account + KMS - START NOW
- ✅ Alchemy - START NOW
- ✅ Blockchair - START NOW

### Week 2 (High Priority)
- ⏳ Sumsub - Apply (1-2 week approval)
- ⏳ MoonPay - Apply (1-2 week approval)
- ⏳ CoinGecko - Immediate

### Week 3 (Medium Priority)
- ⏳ SendGrid - Immediate
- ⏳ Firebase - Immediate

### Week 4+ (Optional/Deferred)
- ⏳ Chainalysis - Contact sales (can defer to Phase 2)
- ⏳ Twilio - Add when implementing SMS

---

## 💰 Estimated Monthly Costs

| Service | Cost/Month | Type |
|---------|------------|------|
| Alchemy | $200 | Subscription |
| Blockchair | $500 | Subscription |
| AWS KMS | $50 | Usage-based |
| CoinGecko | $130 | Subscription |
| SendGrid | $20 | Subscription |
| Firebase | $0 | Free |
| Sumsub | ~$1,000 | Pay-per-use (~500 verifications) |
| MoonPay | $0 | Revenue share (4.5% per tx) |
| **Total Fixed** | **~$900/month** | |
| **Variable** | ~$1,000-5,000 | Depends on volume |

**Total Estimated**: $1,900-5,900/month

---

## 🔑 Environment Variables Summary

Create `.env` file in `apps/backend/`:

```bash
# Blockchain Nodes
ALCHEMY_API_KEY=
ALCHEMY_MAINNET_URL=
ALCHEMY_SEPOLIA_URL=
ALCHEMY_WEBHOOK_SECRET=
BLOCKCHAIR_API_KEY=

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_KMS_KEY_ID=

# KYC & Compliance
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=
SUMSUB_WEBHOOK_SECRET=
CHAINALYSIS_API_KEY= # Optional

# On/Off Ramp
MOONPAY_PUBLISHABLE_KEY=
MOONPAY_SECRET_KEY=
MOONPAY_WEBHOOK_SECRET=

# Price Feeds
COINGECKO_API_KEY=

# Notifications
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
FIREBASE_SERVER_KEY=
TWILIO_ACCOUNT_SID= # Optional
TWILIO_AUTH_TOKEN= # Optional

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/si_crypto
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

---

## ✅ Checklist

- [ ] AWS Account created
- [ ] AWS KMS key created and configured
- [ ] Alchemy account created (Production + Testnet apps)
- [ ] Blockchair API subscription activated
- [ ] Sumsub business account approved
- [ ] MoonPay business account approved
- [ ] CoinGecko API key obtained
- [ ] SendGrid account configured with templates
- [ ] Firebase project created for push notifications
- [ ] All environment variables added to `.env` files
- [ ] Test API keys in development environment
- [ ] Switch to production keys before mainnet launch

---

## 📞 Support Contacts

- **Alchemy Support**: https://www.alchemy.com/support
- **Blockchair**: support@blockchair.com
- **Sumsub**: support@sumsub.com
- **MoonPay**: business@moonpay.com
- **AWS**: AWS Support console
- **CoinGecko**: hello@coingecko.com
- **SendGrid**: https://support.sendgrid.com/
- **Firebase**: https://firebase.google.com/support

---

**Last Updated**: February 2026
**Version**: 1.0.0
