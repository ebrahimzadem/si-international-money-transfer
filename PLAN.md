# Si International Money Transfer - Implementation Plan

## AUDIT RESULTS

### What's Working
- Login/Register screens with OTP flow (demo mode)
- HomeScreen shows balances + crypto cards
- Send screen (token select, address, amount)
- Profile screen (visual layout)
- Backend: Auth (register/login/JWT), Wallets, Transactions
- Database schema deployed on Neon
- Backend deployed on Render (api.sisendsmoney.com)

### What's Broken / Incomplete

| # | Issue | Severity |
|---|-------|----------|
| 1 | **www.sisendsmoney.com not working** - CNAME not set | CRITICAL |
| 2 | **Receive button does nothing** - No ReceiveScreen | HIGH |
| 3 | **Swap button does nothing** - No SwapScreen | HIGH |
| 4 | **Buy button does nothing** - No BuyScreen | MEDIUM |
| 5 | **Transactions screen uses hardcoded mock data** - never calls API | HIGH |
| 6 | **ALL Profile menu items do nothing** (9 items) | HIGH |
| 7 | **Alert.alert used on SendScreen & ProfileScreen** - crashes on web | HIGH |
| 8 | **CryptoCard tap does nothing** - no token detail screen | MEDIUM |
| 9 | **Auth state doesn't persist** - refresh = logout | HIGH |
| 10 | **No price data** - shows +0.00%, $0.00 change | MEDIUM |
| 11 | **Backend has NO OTP endpoints** - frontend calls them but they don't exist | HIGH |
| 12 | **Backend DB uses individual vars** - Render has DATABASE_URL | MEDIUM |
| 13 | **User model missing fullName** in Redux store | LOW |

---

## MODULAR ARCHITECTURE

```
apps/
├── mobile/src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # Base components (Button, Card, Input, Modal)
│   │   ├── ActionButton.tsx
│   │   ├── BalanceHeader.tsx
│   │   ├── CryptoCard.tsx
│   │   └── WebSafeAlert.tsx  [NEW] - replaces Alert.alert everywhere
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx  [UPDATE] - add new screen routes
│   │
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx        ✅ Done
│   │   │   └── RegisterScreen.tsx     ✅ Done
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx         [UPDATE] - persist auth, live prices
│   │   ├── Send/
│   │   │   └── SendScreen.tsx         [FIX] - replace Alert.alert
│   │   ├── Receive/
│   │   │   └── ReceiveScreen.tsx      [NEW] - QR code + copy address
│   │   ├── Swap/
│   │   │   └── SwapScreen.tsx         [NEW] - token swap interface
│   │   ├── TokenDetail/
│   │   │   └── TokenDetailScreen.tsx  [NEW] - price chart + history
│   │   ├── Transactions/
│   │   │   └── TransactionsScreen.tsx [FIX] - fetch real data from API
│   │   └── Profile/
│   │       ├── ProfileScreen.tsx      [FIX] - replace Alert.alert, wire menu
│   │       ├── PersonalDetailsScreen.tsx  [NEW]
│   │       ├── SecurityScreen.tsx         [NEW]
│   │       └── KycScreen.tsx              [NEW]
│   │
│   ├── services/
│   │   └── api.ts             [UPDATE] - add new endpoints
│   │
│   ├── store/
│   │   ├── authSlice.ts       [FIX] - add fullName, persist state
│   │   └── walletSlice.ts     [UPDATE] - price tracking
│   │
│   └── theme/
│       └── colors.ts          ✅ Done
│
├── backend/src/
│   ├── auth/                  [UPDATE] - add OTP endpoints
│   ├── users/                 ✅ Done
│   ├── wallets/               ✅ Done
│   ├── transactions/          ✅ Done
│   ├── blockchain/            ✅ Done
│   ├── otp/                   [NEW] - OTP generation & verification
│   ├── prices/                [NEW] - CoinGecko price feed
│   └── main.ts               [UPDATE] - DATABASE_URL support
```

---

## IMPLEMENTATION PHASES

### Phase 1: Critical Fixes (Foundation)
**Goal: Make the app actually functional on web**

1. **Fix www.sisendsmoney.com** - Add www CNAME in GoDaddy DNS
2. **Create WebSafeAlert component** - Cross-platform modal that works on web
3. **Fix SendScreen** - Replace all Alert.alert with WebSafeAlert
4. **Fix ProfileScreen** - Replace Alert.alert logout with WebSafeAlert
5. **Persist auth state** - Save user to localStorage/SecureStore on login, restore on app load
6. **Fix authSlice** - Add fullName to User interface
7. **Fix backend DATABASE_URL** - Parse connection string instead of individual vars

### Phase 2: Core Screens (Features)
**Goal: Make all buttons actually work**

8. **ReceiveScreen** - Show wallet address, copy button, QR code (using react-native-qrcode-svg or simple text for web)
9. **SwapScreen** - Token pair selector, amount input, estimated output, confirm swap
10. **TokenDetailScreen** - Token info, balance, price chart placeholder, recent transactions for that token
11. **Wire TransactionsScreen to API** - Fetch real transaction data, keep mock as fallback
12. **Add OTP endpoints to backend** - Generate 6-digit codes, store temporarily, verify

### Phase 3: Profile & Settings
**Goal: Profile menu items work**

13. **PersonalDetailsScreen** - View/edit name, email, phone
14. **SecurityScreen** - Change password, 2FA toggle
15. **KycScreen** - Show verification status, upload documents placeholder
16. **Wire remaining menu items** - Notifications (toggle), Currency (selector), Appearance (dark mode toggle), Help (info page), Legal (terms page), About (version info)

### Phase 4: Price Data & Polish
**Goal: Real-time feel**

17. **Add price service to backend** - Fetch from CoinGecko free API
18. **Show real USD values** - Update BalanceHeader with actual % change
19. **Add pull-to-refresh everywhere** - Already on HomeScreen, add to others
20. **Navigation polish** - Smooth transitions, proper back handling

---

## PHASE 1 DETAILS (Starting Now)

### 1.1 WebSafeAlert Component
Create `components/WebSafeAlert.tsx` - a Modal-based alert that works on all platforms:
- Title, message, buttons (cancel/confirm)
- Animated fade-in
- Si brand styling
- Drop-in replacement for Alert.alert

### 1.2 Auth Persistence
In `api.ts`, after login/register saves tokens, also save user data.
In `AppNavigator.tsx`, check for stored user on mount and dispatch `setUser`.

### 1.3 Backend DATABASE_URL
Update `wallets.service.ts` and `transactions.service.ts` to use:
```typescript
const databaseUrl = this.configService.get<string>('DATABASE_URL');
this.pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
```

### 1.4 Fix SendScreen & ProfileScreen
Replace every `Alert.alert(...)` call with the new WebSafeAlert modal pattern.
