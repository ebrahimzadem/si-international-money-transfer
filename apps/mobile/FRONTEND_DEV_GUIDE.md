# 🎨 Si Mobile App - Frontend Development Guide

## 🚀 Quick Start

```bash
# Start development server
npm start

# Start web version
npm run web

# Start on iOS simulator
npm run ios

# Start on Android emulator
npm run android
```

## 📁 Project Structure

```
apps/mobile/
├── src/
│   ├── components/           # Reusable UI components
│   │   └── ui/              # Base UI components (Button, Card, Input)
│   ├── screens/             # Screen components
│   │   ├── Auth/            # Login, Register
│   │   ├── Home/            # Dashboard
│   │   ├── Send/            # Send crypto
│   │   ├── Transactions/    # Transaction history
│   │   └── Profile/         # User profile
│   ├── navigation/          # React Navigation setup
│   ├── store/              # Redux store
│   ├── services/           # API services
│   ├── theme/              # Colors, fonts, spacing
│   └── types/              # TypeScript types
├── assets/                 # Images, fonts, icons
└── App.tsx                 # Root component
```

## 🎨 Design System

### Brand Colors
```typescript
import { Colors } from '@/theme/colors';

// Primary (Green/Teal from Si logo)
Colors.primary        // #2d5f4b - Deep green
Colors.primaryLight   // #3a7a5f
Colors.secondary      // #4a9b7f - Teal accent

// Gradients
Colors.gradientStart  // For gradient backgrounds
Colors.gradientMid
Colors.gradientEnd
```

### Typography
```typescript
import { Fonts, FontSizes } from '@/theme/colors';

// Font Families (System fonts for now, Sen coming soon)
Fonts.regular         // Regular weight
Fonts.semiBold       // Semi-bold
Fonts.bold           // Bold
Fonts.extraBold      // Extra bold

// Sizes
FontSizes.xs         // 12px
FontSizes.sm         // 14px
FontSizes.md         // 16px
FontSizes.lg         // 18px
FontSizes.xl         // 20px
FontSizes.xxl        // 24px
FontSizes.xxxl       // 32px
```

### Spacing & Layout
```typescript
import { Spacing, BorderRadius } from '@/theme/colors';

// Spacing
Spacing.xs          // 4px
Spacing.sm          // 8px
Spacing.md          // 12px
Spacing.lg          // 16px
Spacing.xl          // 20px
Spacing.xxl         // 24px

// Border Radius
BorderRadius.sm     // 8px
BorderRadius.md     // 12px
BorderRadius.lg     // 16px
BorderRadius.xl     // 20px
BorderRadius.xxl    // 24px
```

## 🧩 UI Components

### Button
```tsx
import { Button } from '@/components/ui';

<Button
  title="Sign In"
  onPress={handleLogin}
  variant="primary"    // primary | secondary | outline | ghost
  size="md"            // sm | md | lg
  loading={isLoading}
  fullWidth
/>
```

### Input
```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  placeholder="your@email.com"
  value={email}
  onChangeText={setEmail}
  error={emailError}
  helperText="We'll never share your email"
/>
```

### Card
```tsx
import { Card } from '@/components/ui';

<Card variant="elevated" padding="lg">
  <Text>Card content</Text>
</Card>
```

## 🎭 Gradients

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/colors';

<LinearGradient
  colors={[Colors.primary, Colors.secondary]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 0 }}
  style={styles.gradient}
>
  {/* Content */}
</LinearGradient>
```

## 🔄 State Management

### Redux Store
```tsx
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';

// In component
const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
const { balances, totalUsd } = useSelector((state: RootState) => state.wallet);
const dispatch = useDispatch();
```

### API Calls
```tsx
import api from '@/services/api';

// Register
const response = await api.register(email, password);

// Login
const response = await api.login(email, password);

// Get balances
const balances = await api.getBalances();

// Send transaction
await api.sendTransaction(token, toAddress, amount);
```

## 🎯 Screen Development

### Creating a New Screen

1. Create screen file: `src/screens/MyScreen/MyScreen.tsx`
2. Add to navigation: `src/navigation/AppNavigator.tsx`
3. Use design system components
4. Connect to Redux if needed

Example:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card } from '@/components/ui';
import { Colors, Spacing } from '@/theme/colors';

export default function MyScreen() {
  return (
    <View style={styles.container}>
      <Card variant="elevated">
        <Text>My Screen Content</Text>
        <Button title="Action" onPress={() => {}} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.gray50,
  },
});
```

## 🔧 Development Tips

### Hot Reload
- Save any file to trigger hot reload
- Shake device or press `R` to reload manually

### Debugging
- Open Chrome DevTools: `Cmd+D` (iOS) or `Cmd+M` (Android)
- Web: Open browser console (F12)

### Code Formatting
```bash
# Format all files
npx prettier --write "src/**/*.{ts,tsx}"

# Check linting
npx eslint src/
```

### TypeScript
- Always define prop interfaces
- Use type-safe Redux hooks
- Avoid `any` types when possible

## 📱 Testing

### Web Testing
```bash
npm run web
# Open http://localhost:8081
```

### Device Testing
1. Install Expo Go app
2. Scan QR code from terminal
3. Test on real device

## 🚀 Build for Production

### Web Build
```bash
npx expo build:web
```

### iOS Build
```bash
npx expo build:ios
```

### Android Build
```bash
npx expo build:android
```

## 📚 Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Redux Toolkit](https://redux-toolkit.js.org/)

## 🎨 Design Assets

- Logo: `assets/si-logo.png`
- Brand Colors: See `src/theme/colors.ts`
- Crypto Icons: Use token colors from theme

---

**Happy Coding! 🚀**
