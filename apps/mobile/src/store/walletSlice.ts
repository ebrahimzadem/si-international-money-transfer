import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Balance {
  token: 'BTC' | 'ETH' | 'USDC' | 'USDT';
  balance: string;
  balanceUsd: number;
  address: string;
}

interface WalletState {
  balances: Balance[];
  totalUsd: number;
  isLoading: boolean;
}

const initialState: WalletState = {
  balances: [
    {
      token: 'BTC',
      balance: '0.05432',
      balanceUsd: 2345.67,
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    },
    {
      token: 'ETH',
      balance: '1.2345',
      balanceUsd: 2891.23,
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    },
    {
      token: 'USDC',
      balance: '5000.00',
      balanceUsd: 5000.00,
      address: '0x8e23Ee67d1332aD560396262C48ffbB273f626',
    },
  ],
  totalUsd: 10236.90,
  isLoading: false,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalances(state, action: PayloadAction<Balance[]>) {
      state.balances = action.payload;
      state.totalUsd = action.payload.reduce((sum, b) => sum + b.balanceUsd, 0);
      state.isLoading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearBalances(state) {
      state.balances = [];
      state.totalUsd = 0;
    },
  },
});

export const { setBalances, setLoading, clearBalances } = walletSlice.actions;
export default walletSlice.reducer;
