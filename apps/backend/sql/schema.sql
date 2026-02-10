-- Si Crypto Platform - PostgreSQL Database Schema
-- Version: 1.0.0
-- Date: February 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, rejected
  kyc_level INT NOT NULL DEFAULT 1, -- 1: $1k/day, 2: $10k/day, 3: $100k/day
  kyc_provider VARCHAR(50), -- sumsub, jumio
  kyc_verified_at TIMESTAMP,
  risk_score INT, -- 0-100 from AML screening
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret VARCHAR(255), -- TOTP secret (encrypted)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  CONSTRAINT chk_kyc_status CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT chk_kyc_level CHECK (kyc_level BETWEEN 1 AND 3)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);


-- ============================================================================
-- KYC VERIFICATION
-- ============================================================================

CREATE TABLE kyc_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- sumsub, jumio
  verification_id VARCHAR(100), -- Provider's verification ID
  status VARCHAR(20) NOT NULL, -- pending, approved, rejected, manual_review
  identity_document_type VARCHAR(50), -- passport, drivers_license, id_card
  document_number VARCHAR(100), -- Encrypted
  document_expiry DATE,
  face_match_score DECIMAL(5, 2), -- 0-100
  address_verified BOOLEAN,
  rejection_reason TEXT,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_kyc_status CHECK (status IN ('pending', 'approved', 'rejected', 'manual_review'))
);

CREATE INDEX idx_kyc_user ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);


-- ============================================================================
-- WALLET MANAGEMENT
-- ============================================================================

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain VARCHAR(20) NOT NULL, -- bitcoin, ethereum
  address VARCHAR(100) NOT NULL UNIQUE,
  derivation_path VARCHAR(100) NOT NULL, -- m/44'/60'/0'/0/123
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'custodial', -- custodial, non-custodial
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, closed
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_chain CHECK (chain IN ('bitcoin', 'ethereum')),
  CONSTRAINT chk_wallet_type CHECK (wallet_type IN ('custodial', 'non-custodial')),
  UNIQUE(user_id, chain)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);
CREATE INDEX idx_wallets_chain ON wallets(chain);


-- ============================================================================
-- CRYPTO BALANCES
-- ============================================================================

CREATE TABLE crypto_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  token VARCHAR(20) NOT NULL, -- BTC, ETH, USDC
  balance DECIMAL(36, 18) NOT NULL DEFAULT 0, -- Support 18 decimals
  available_balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
  pending_balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
  locked_balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
  usd_value DECIMAL(18, 2), -- Cached USD value
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_token CHECK (token IN ('BTC', 'ETH', 'USDC')),
  CONSTRAINT chk_balances_positive CHECK (
    balance >= 0 AND
    available_balance >= 0 AND
    pending_balance >= 0 AND
    locked_balance >= 0
  ),
  UNIQUE(wallet_id, token)
);

CREATE INDEX idx_balances_wallet ON crypto_balances(wallet_id);
CREATE INDEX idx_balances_token ON crypto_balances(token);


-- ============================================================================
-- BLOCKCHAIN TRANSACTIONS
-- ============================================================================

CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  chain VARCHAR(20) NOT NULL,
  tx_hash VARCHAR(100) NOT NULL UNIQUE,
  from_address VARCHAR(100),
  to_address VARCHAR(100),
  token VARCHAR(20) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  gas_fee DECIMAL(36, 18),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
  confirmations INT NOT NULL DEFAULT 0,
  required_confirmations INT NOT NULL, -- BTC: 3, ETH: 12
  direction VARCHAR(10) NOT NULL, -- inbound, outbound
  transaction_type VARCHAR(20), -- deposit, withdrawal, swap
  metadata JSONB, -- Additional transaction data
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  CONSTRAINT chk_tx_status CHECK (status IN ('pending', 'confirmed', 'failed')),
  CONSTRAINT chk_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_tx_hash ON blockchain_transactions(tx_hash);
CREATE INDEX idx_tx_user ON blockchain_transactions(user_id);
CREATE INDEX idx_tx_wallet ON blockchain_transactions(wallet_id);
CREATE INDEX idx_tx_status ON blockchain_transactions(status);
CREATE INDEX idx_tx_created ON blockchain_transactions(created_at DESC);
CREATE INDEX idx_tx_pending ON blockchain_transactions(status, created_at) WHERE status = 'pending';


-- ============================================================================
-- DEPOSITS
-- ============================================================================

CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blockchain_transaction_id UUID REFERENCES blockchain_transactions(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  token VARCHAR(20) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed
  credited_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_deposit_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);


-- ============================================================================
-- WITHDRAWALS
-- ============================================================================

CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blockchain_transaction_id UUID REFERENCES blockchain_transactions(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  to_address VARCHAR(100) NOT NULL,
  token VARCHAR(20) NOT NULL,
  chain VARCHAR(20) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  gas_fee DECIMAL(36, 18),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, broadcasted, completed, rejected
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id), -- Admin who approved
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT chk_withdrawal_status CHECK (status IN ('pending', 'approved', 'broadcasted', 'completed', 'rejected')),
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_pending ON withdrawals(status, approval_required) WHERE status = 'pending';


-- ============================================================================
-- ON-RAMP TRANSACTIONS (Buy Crypto)
-- ============================================================================

CREATE TABLE on_ramp_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'moonpay',
  external_id VARCHAR(100), -- MoonPay transaction ID
  fiat_amount DECIMAL(18, 2) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL, -- USD, EUR
  crypto_amount DECIMAL(36, 18) NOT NULL,
  crypto_currency VARCHAR(20) NOT NULL,
  payment_method VARCHAR(50), -- card, bank_transfer
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  provider_fee DECIMAL(18, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT chk_onramp_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT chk_amounts_positive CHECK (fiat_amount > 0 AND crypto_amount > 0)
);

CREATE INDEX idx_onramp_user ON on_ramp_transactions(user_id);
CREATE INDEX idx_onramp_external ON on_ramp_transactions(external_id);
CREATE INDEX idx_onramp_status ON on_ramp_transactions(status);


-- ============================================================================
-- OFF-RAMP TRANSACTIONS (Sell Crypto)
-- ============================================================================

CREATE TABLE off_ramp_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  external_id VARCHAR(100),
  crypto_amount DECIMAL(36, 18) NOT NULL,
  crypto_currency VARCHAR(20) NOT NULL,
  fiat_amount DECIMAL(18, 2) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL,
  bank_account_id UUID, -- Reference to user's linked bank account
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider_fee DECIMAL(18, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT chk_offramp_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_offramp_user ON off_ramp_transactions(user_id);
CREATE INDEX idx_offramp_status ON off_ramp_transactions(status);


-- ============================================================================
-- SWAPS (Crypto to Crypto)
-- ============================================================================

CREATE TABLE swaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_token VARCHAR(20) NOT NULL,
  to_token VARCHAR(20) NOT NULL,
  from_amount DECIMAL(36, 18) NOT NULL,
  to_amount DECIMAL(36, 18) NOT NULL,
  exchange_rate DECIMAL(36, 18) NOT NULL,
  slippage DECIMAL(5, 2), -- Percentage
  fee_amount DECIMAL(36, 18) NOT NULL,
  fee_percentage DECIMAL(5, 2), -- e.g., 1.00 for 1%
  provider VARCHAR(50), -- 1inch, jupiter, internal
  blockchain_transaction_id UUID REFERENCES blockchain_transactions(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT chk_swap_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT chk_swap_amounts CHECK (from_amount > 0 AND to_amount > 0)
);

CREATE INDEX idx_swaps_user ON swaps(user_id);
CREATE INDEX idx_swaps_status ON swaps(status);
CREATE INDEX idx_swaps_created ON swaps(created_at DESC);


-- ============================================================================
-- PRICE HISTORY
-- ============================================================================

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(20) NOT NULL,
  price_usd DECIMAL(18, 8) NOT NULL,
  price_btc DECIMAL(18, 8), -- Price in BTC
  market_cap DECIMAL(20, 2),
  volume_24h DECIMAL(20, 2),
  change_24h DECIMAL(10, 2), -- Percentage
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) NOT NULL, -- coingecko, binance
  CONSTRAINT chk_price_positive CHECK (price_usd > 0)
);

CREATE INDEX idx_price_token_time ON price_history(token, timestamp DESC);
CREATE INDEX idx_price_timestamp ON price_history(timestamp DESC);


-- ============================================================================
-- PAYMENT METHODS
-- ============================================================================

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- card, bank_account
  provider VARCHAR(50) NOT NULL, -- stripe, plaid
  provider_payment_method_id VARCHAR(100) NOT NULL,
  card_last4 VARCHAR(4),
  card_brand VARCHAR(20),
  card_exp_month INT,
  card_exp_year INT,
  bank_name VARCHAR(100),
  bank_last4 VARCHAR(4),
  bank_account_type VARCHAR(20), -- checking, savings
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_payment_type CHECK (type IN ('card', 'bank_account'))
);

CREATE INDEX idx_payment_user ON payment_methods(user_id);
CREATE INDEX idx_payment_default ON payment_methods(user_id, is_default) WHERE is_default = true;


-- ============================================================================
-- AML CHECKS
-- ============================================================================

CREATE TABLE aml_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(100) NOT NULL,
  chain VARCHAR(20) NOT NULL,
  risk_score INT, -- 0-100
  risk_level VARCHAR(20), -- low, medium, high, severe
  provider VARCHAR(50) NOT NULL, -- chainalysis, elliptic
  result_json JSONB, -- Full report
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_aml_address ON aml_checks(wallet_address);
CREATE INDEX idx_aml_risk ON aml_checks(risk_level);


-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- user, wallet, transaction, withdrawal
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);


-- ============================================================================
-- WITHDRAWAL APPROVALS
-- ============================================================================

CREATE TABLE withdrawal_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL, -- approved, rejected
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_approval_action CHECK (action IN ('approved', 'rejected'))
);

CREATE INDEX idx_approval_withdrawal ON withdrawal_approvals(withdrawal_id);


-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update balance last_updated
CREATE OR REPLACE FUNCTION update_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for crypto_balances
CREATE TRIGGER update_balances_timestamp BEFORE UPDATE ON crypto_balances
    FOR EACH ROW EXECUTE FUNCTION update_balance_timestamp();


-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert supported tokens in price_history (placeholder)
INSERT INTO price_history (token, price_usd, source, timestamp) VALUES
  ('BTC', 40000.00, 'coingecko', CURRENT_TIMESTAMP),
  ('ETH', 2500.00, 'coingecko', CURRENT_TIMESTAMP),
  ('USDC', 1.00, 'coingecko', CURRENT_TIMESTAMP);


-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for user portfolio summary
CREATE OR REPLACE VIEW user_portfolios AS
SELECT
  u.id AS user_id,
  u.email,
  COUNT(DISTINCT w.id) AS wallet_count,
  SUM(cb.usd_value) AS total_usd_value,
  json_agg(
    json_build_object(
      'token', cb.token,
      'balance', cb.balance,
      'usd_value', cb.usd_value
    )
  ) AS balances
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN crypto_balances cb ON w.id = cb.wallet_id
GROUP BY u.id, u.email;

-- View for pending transactions
CREATE OR REPLACE VIEW pending_transactions AS
SELECT
  bt.id,
  bt.user_id,
  u.email,
  bt.chain,
  bt.token,
  bt.amount,
  bt.direction,
  bt.confirmations,
  bt.required_confirmations,
  bt.created_at
FROM blockchain_transactions bt
JOIN users u ON bt.user_id = u.id
WHERE bt.status = 'pending'
ORDER BY bt.created_at DESC;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with KYC status and tier information';
COMMENT ON TABLE wallets IS 'Multi-chain cryptocurrency wallets (custodial)';
COMMENT ON TABLE crypto_balances IS 'Token balances with available, pending, and locked amounts';
COMMENT ON TABLE blockchain_transactions IS 'All blockchain transactions (deposits and withdrawals)';
COMMENT ON TABLE withdrawals IS 'Withdrawal requests with approval workflow';
COMMENT ON TABLE on_ramp_transactions IS 'Fiat to crypto purchases via MoonPay';
COMMENT ON TABLE swaps IS 'Crypto to crypto exchanges';
COMMENT ON TABLE price_history IS 'Historical price data for portfolio calculations';
COMMENT ON TABLE audit_logs IS 'Security and compliance audit trail';

COMMENT ON COLUMN users.kyc_level IS '1: $1k/day limit, 2: $10k/day limit, 3: $100k/day limit';
COMMENT ON COLUMN wallets.derivation_path IS 'BIP44 derivation path: m/44''/coin''/0''/0/{userId}';
COMMENT ON COLUMN crypto_balances.balance IS 'Total balance (available + pending + locked)';
COMMENT ON COLUMN blockchain_transactions.required_confirmations IS 'BTC: 3, ETH: 12, Polygon: 128';
