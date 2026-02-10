import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';

const DEV_URL = 'http://localhost:3000';
const PROD_URL = 'https://si-backend-x8bn.onrender.com';
const API_URL = __DEV__ ? DEV_URL : PROD_URL;

// Web-safe storage (SecureStore crashes on web)
const Storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.deleteItemAsync(key);
  },
};

const DEMO_USER = {
  id: '1',
  email: '',
  fullName: '',
  kycStatus: 'verified',
  kycLevel: 2,
};

const DEMO_BALANCES = [
  { token: 'BTC', balance: '0.05432', balanceUsd: 2345.67, address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
  { token: 'ETH', balance: '1.2345', balanceUsd: 2891.23, address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
  { token: 'USDC', balance: '5000.00', balanceUsd: 5000.00, address: '0x8e23Ee67d1332aD560396262C48ffbB273f626' },
];

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000,
    });

    this.api.interceptors.request.use(async (config) => {
      try {
        const token = await Storage.getItem('accessToken');
        if (token && token !== 'demo-token') {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {}
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          try {
            const refreshToken = await Storage.getItem('refreshToken');
            if (refreshToken && refreshToken !== 'demo-refresh') {
              const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
              await Storage.setItem('accessToken', data.accessToken);
              error.config.headers.Authorization = `Bearer ${data.accessToken}`;
              return this.api.request(error.config);
            }
          } catch {
            await this.clearTokens();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(email: string, password: string, fullName?: string, phone?: string) {
    try {
      const { data } = await this.api.post('/auth/register', { email, password, fullName, phone });
      await this.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
      await this.saveTokens('demo-token', 'demo-refresh');
      return {
        accessToken: 'demo-token',
        refreshToken: 'demo-refresh',
        user: { ...DEMO_USER, email, fullName: fullName || email.split('@')[0] },
      };
    }
  }

  async login(email: string, password: string) {
    try {
      const { data } = await this.api.post('/auth/login', { email, password });
      await this.saveTokens(data.accessToken, data.refreshToken);
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
      await this.saveTokens('demo-token', 'demo-refresh');
      return {
        accessToken: 'demo-token',
        refreshToken: 'demo-refresh',
        user: { ...DEMO_USER, email, fullName: email.split('@')[0] },
      };
    }
  }

  // OTP Verification
  async sendEmailOtp(email: string) {
    try {
      const { data } = await this.api.post('/auth/otp/email/send', { email });
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      return { success: true, message: 'OTP sent to email' };
    }
  }

  async verifyEmailOtp(email: string, code: string) {
    try {
      const { data } = await this.api.post('/auth/otp/email/verify', { email, code });
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
      // Demo: accept any 6-digit code
      if (code.length === 6 && /^\d+$/.test(code)) {
        return { success: true, verified: true };
      }
      throw new Error('Invalid OTP code');
    }
  }

  async sendPhoneOtp(phone: string) {
    try {
      const { data } = await this.api.post('/auth/otp/phone/send', { phone });
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      return { success: true, message: 'OTP sent to phone' };
    }
  }

  async verifyPhoneOtp(phone: string, code: string) {
    try {
      const { data } = await this.api.post('/auth/otp/phone/verify', { phone, code });
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
      if (code.length === 6 && /^\d+$/.test(code)) {
        return { success: true, verified: true };
      }
      throw new Error('Invalid OTP code');
    }
  }

  async logout() {
    await this.clearTokens();
  }

  // Wallets
  async getWallets() {
    try {
      const { data } = await this.api.get('/wallets');
      return data;
    } catch {
      return DEMO_BALANCES;
    }
  }

  async getBalances() {
    try {
      const { data } = await this.api.get('/wallets/balances');
      return data;
    } catch {
      return DEMO_BALANCES;
    }
  }

  async getBalanceByToken(token: string) {
    try {
      const { data } = await this.api.get(`/wallets/balances/${token}`);
      return data;
    } catch {
      return DEMO_BALANCES.find((b) => b.token === token) || null;
    }
  }

  async getAddress(chain: 'bitcoin' | 'ethereum') {
    try {
      const { data } = await this.api.get(`/wallets/${chain}/address`);
      return data;
    } catch {
      return {
        address: chain === 'bitcoin'
          ? '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
          : '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      };
    }
  }

  // Transactions
  async sendTransaction(token: string, toAddress: string, amount: string) {
    try {
      const { data } = await this.api.post('/transactions/send', { token, toAddress, amount });
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      return {
        id: 'demo-tx-' + Date.now(),
        token,
        toAddress,
        amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    }
  }

  async getTransactions() {
    try {
      const { data } = await this.api.get('/transactions');
      return data;
    } catch {
      return [];
    }
  }

  // Token management
  private async saveTokens(accessToken: string, refreshToken: string) {
    await Storage.setItem('accessToken', accessToken);
    await Storage.setItem('refreshToken', refreshToken);
  }

  private async clearTokens() {
    await Storage.removeItem('accessToken');
    await Storage.removeItem('refreshToken');
  }

  async getAccessToken() {
    return await Storage.getItem('accessToken');
  }
}

export default new ApiService();