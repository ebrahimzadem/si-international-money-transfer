# Firebase Setup Guide for Si Crypto Platform

## 📱 Step 1: Add Android App to Firebase

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**
3. **Click "Add app"** → Select **Android** icon
4. **Register app**:
   - Package name: `com.sicrypto.app` (or your choice)
   - App nickname: `Si Crypto Android`
   - Click "Register app"

5. **Download `google-services.json`**:
   - Click "Download google-services.json"
   - Save the file

6. **Add to your project**:
   ```bash
   # Create android app directory if it doesn't exist
   mkdir -p apps/mobile/android/app

   # Move the downloaded file
   # Copy google-services.json to: apps/mobile/android/app/
   ```

---

## 📱 Step 2: Add iOS App to Firebase (Optional - for iOS support)

1. **In Firebase Console**, click **"Add app"** → Select **iOS** icon
2. **Register app**:
   - Bundle ID: `com.sicrypto.app`
   - App nickname: `Si Crypto iOS`
   - Click "Register app"

3. **Download `GoogleService-Info.plist`**:
   - Click "Download GoogleService-Info.plist"

4. **Add to your project**:
   ```bash
   # Create ios directory if needed
   mkdir -p apps/mobile/ios

   # Move the downloaded file
   # Copy GoogleService-Info.plist to: apps/mobile/ios/
   ```

---

## 🔑 Step 3: Get Server Key (for Backend)

1. **In Firebase Console**, go to **Project Settings** (gear icon)
2. **Click "Cloud Messaging" tab**
3. **Find "Server key"** under "Cloud Messaging API (Legacy)"
4. **Copy the Server Key**

**Important**: If you don't see "Cloud Messaging API", you need to enable it:
- Click "Manage API in Google Cloud Console"
- Enable "Cloud Messaging API"
- Come back and refresh

---

## 🔑 Step 4: Get Firebase Configuration

### For Backend (Server Key):

1. In **Firebase Console** → **Project Settings** → **Cloud Messaging**
2. Copy the **Server key**
3. Copy the **Sender ID**

### For Mobile App (Config):

1. In **Firebase Console** → **Project Settings** → **General**
2. Scroll to "Your apps" section
3. Click on your **Android app**
4. Copy these values:
   - `apiKey`
   - `projectId`
   - `messagingSenderId`
   - `appId`

---

## ⚙️ Step 5: Configure Backend Environment

Edit `apps/backend/.env`:

```bash
# Firebase Cloud Messaging (Push Notifications)
FIREBASE_SERVER_KEY=AAAA...your_server_key_here
FIREBASE_PROJECT_ID=si-crypto-app
FIREBASE_SENDER_ID=123456789012
```

**Where to find**:
- Server Key: Firebase Console → Project Settings → Cloud Messaging → Server key
- Project ID: Firebase Console → Project Settings → General → Project ID
- Sender ID: Firebase Console → Project Settings → Cloud Messaging → Sender ID

---

## 📱 Step 6: Install Firebase in Mobile App

```bash
cd apps/mobile

# Install Firebase and Expo notifications
npx expo install expo-notifications expo-device expo-constants
npx expo install @react-native-firebase/app @react-native-firebase/messaging
```

---

## 🔧 Step 7: Configure Mobile App

### Create Firebase config file:

Create `apps/mobile/src/config/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// Firebase configuration (from Firebase Console)
const firebaseConfig = {
  apiKey: "AIza...your_api_key",
  authDomain: "si-crypto-app.firebaseapp.com",
  projectId: "si-crypto-app",
  storageBucket: "si-crypto-app.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:android:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { app, messaging };
```

### Update `app.json`:

Add this to `apps/mobile/app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.sicrypto.app"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "bundleIdentifier": "com.sicrypto.app"
    },
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#4630EB",
      "androidMode": "default",
      "androidCollapsedTitle": "#{unread_notifications} new notifications"
    }
  }
}
```

---

## 🧪 Step 8: Test Push Notifications

### A. Request Permission (Mobile App)

Create `apps/mobile/src/services/notificationService.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission not granted for push notifications');
    return null;
  }

  // Get push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id', // From app.json
  });

  console.log('Push token:', token.data);

  // Configure for Android
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token.data;
}

// Listen for notifications
export function setupNotificationListeners() {
  // Notification received while app is in foreground
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
  });

  // User tapped on notification
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification tapped:', response);
  });
}
```

### B. Use in App.tsx:

```typescript
import { useEffect } from 'react';
import { registerForPushNotifications, setupNotificationListeners } from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications().then((token) => {
      if (token) {
        console.log('Device token:', token);
        // TODO: Send token to backend to save in database
      }
    });

    // Setup listeners
    setupNotificationListeners();
  }, []);

  return (
    // Your app UI
  );
}
```

### C. Send Test Notification from Backend:

Create `apps/backend/src/services/notification.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly serverKey: string;

  constructor(private configService: ConfigService) {
    this.serverKey = this.configService.get<string>('FIREBASE_SERVER_KEY');
  }

  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    const message = {
      to: deviceToken,
      notification: {
        title,
        body,
        sound: 'default',
      },
      data: data || {},
      priority: 'high',
    };

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Notification sent:', result);
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Example: Send deposit notification
  async sendDepositNotification(userId: string, amount: string, token: string) {
    // Get user's device token from database
    const deviceToken = await this.getUserDeviceToken(userId);

    if (!deviceToken) {
      console.log('No device token for user:', userId);
      return;
    }

    await this.sendPushNotification(
      deviceToken,
      'Deposit Received! 🎉',
      `You received ${amount} ${token}`,
      {
        type: 'deposit',
        amount,
        token,
      },
    );
  }

  private async getUserDeviceToken(userId: string): Promise<string | null> {
    // TODO: Query database for user's device token
    // For now, return null
    return null;
  }
}
```

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Android app added to Firebase
- [ ] `google-services.json` downloaded and placed in `apps/mobile/android/app/`
- [ ] Server Key copied from Firebase Console
- [ ] Server Key added to `apps/backend/.env`
- [ ] Project ID added to `apps/backend/.env`
- [ ] Firebase packages installed in mobile app
- [ ] Firebase config created in mobile app
- [ ] Notification service created
- [ ] Test notification sent successfully

---

## 🧪 Quick Test

### Test from Firebase Console:

1. Go to **Firebase Console** → **Cloud Messaging**
2. Click **"Send your first message"**
3. Fill in:
   - Notification title: "Test"
   - Notification text: "Hello from Firebase!"
4. Click **"Send test message"**
5. Paste your device FCM token
6. Click **"Test"**

---

## 📊 What's Next?

After Firebase is configured:

1. **Save device tokens** to database when users log in
2. **Send notifications** for:
   - Deposit received
   - Withdrawal completed
   - Swap executed
   - Security alerts
3. **Handle notification clicks** to navigate to relevant screens

---

## 🆘 Troubleshooting

### "Server key not found"
- Make sure Cloud Messaging API is enabled
- Check Project Settings → Cloud Messaging tab
- You might need to enable legacy API

### "google-services.json not found"
- File must be in: `apps/mobile/android/app/google-services.json`
- Rebuild app after adding file

### "Permission denied"
- On Android: Check app permissions in Settings
- On iOS: User must grant permission when prompted

### "Token null or undefined"
- Only works on physical devices (not simulator)
- Expo Go app: Use Expo push token instead of FCM

---

## 📝 Environment Variables Summary

Add these to `apps/backend/.env`:

```bash
# Firebase Cloud Messaging
FIREBASE_SERVER_KEY=AAAA...your_server_key
FIREBASE_PROJECT_ID=si-crypto-app
FIREBASE_SENDER_ID=123456789012
```

---

**You're all set! Firebase push notifications are ready to use! 🔥**
