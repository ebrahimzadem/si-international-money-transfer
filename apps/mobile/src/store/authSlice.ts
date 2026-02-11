import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  fullName?: string;
  kycStatus: string;
  kycLevel: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Restore persisted user on load (web only - sync)
function getPersistedUser(): User | null {
  if (Platform.OS === 'web') {
    try {
      const stored = localStorage.getItem('si_user');
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return null;
}

function getPersistedAuth(): boolean {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem('accessToken') !== null && localStorage.getItem('si_user') !== null;
    } catch {}
  }
  return false;
}

const persistedUser = getPersistedUser();

const initialState: AuthState = {
  user: persistedUser,
  isAuthenticated: !!persistedUser,
  isLoading: !persistedUser && Platform.OS !== 'web', // On native, check SecureStore async
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
      // Persist user data
      if (Platform.OS === 'web') {
        try { localStorage.setItem('si_user', JSON.stringify(action.payload)); } catch {}
      }
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      // Clear persisted data
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem('si_user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        } catch {}
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = authSlice.actions;
export default authSlice.reducer;
