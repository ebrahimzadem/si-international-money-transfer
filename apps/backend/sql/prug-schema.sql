-- ============================================================================
-- Prug — carpet identity registry
-- Applies on top of schema.sql (users table and uuid-ossp are required)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CARPETS
-- ============================================================================

CREATE TABLE prug_carpets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  title VARCHAR(160) NOT NULL,

  -- Owner-declared attributes, checked against the photographs during analysis
  declared JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI-extracted identity document (the شناسنامه)
  identity JSONB,
  identity_model VARCHAR(60),

  certificate_number VARCHAR(32) UNIQUE,
  certificate_issued_at TIMESTAMP,

  risk_score INT,
  risk_level VARCHAR(10),
  review_notes TEXT,

  -- Public profile
  profile_slug VARCHAR(80) NOT NULL UNIQUE,
  profile_visibility VARCHAR(10) NOT NULL DEFAULT 'public',
  profile_story TEXT,
  cover_photo_id UUID,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_prug_status CHECK (status IN ('draft','analyzing','verified','manual_review','rejected','transferring')),
  CONSTRAINT chk_prug_risk_level CHECK (risk_level IS NULL OR risk_level IN ('low','medium','high','severe')),
  CONSTRAINT chk_prug_visibility CHECK (profile_visibility IN ('public','unlisted','private')),
  CONSTRAINT chk_prug_risk_score CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_prug_carpets_owner ON prug_carpets(owner_user_id);
CREATE INDEX idx_prug_carpets_status ON prug_carpets(status);
CREATE INDEX idx_prug_carpets_certificate ON prug_carpets(certificate_number);

CREATE TRIGGER update_prug_carpets_updated_at BEFORE UPDATE ON prug_carpets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PHOTOS
-- ============================================================================

CREATE TABLE prug_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,
  shot_type VARCHAR(24) NOT NULL,
  position INT NOT NULL,

  storage_key TEXT NOT NULL,
  mime_type VARCHAR(30) NOT NULL,
  byte_size BIGINT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,

  -- Exact-duplicate detection
  sha256 CHAR(64) NOT NULL,

  -- Perceptual fingerprints, hex-encoded 64-bit hashes.
  -- band0..band3 are 16-bit slices of dhash, indexed so near-duplicate lookup
  -- can find candidates without scanning every photo in the registry.
  dhash CHAR(16),
  phash CHAR(16),
  band0 INT,
  band1 INT,
  band2 INT,
  band3 INT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(carpet_id, sha256)
);

CREATE INDEX idx_prug_photos_carpet ON prug_photos(carpet_id);
CREATE INDEX idx_prug_photos_sha256 ON prug_photos(sha256);
CREATE INDEX idx_prug_photos_band0 ON prug_photos(band0) WHERE band0 IS NOT NULL;
CREATE INDEX idx_prug_photos_band1 ON prug_photos(band1) WHERE band1 IS NOT NULL;
CREATE INDEX idx_prug_photos_band2 ON prug_photos(band2) WHERE band2 IS NOT NULL;
CREATE INDEX idx_prug_photos_band3 ON prug_photos(band3) WHERE band3 IS NOT NULL;

ALTER TABLE prug_carpets
  ADD CONSTRAINT fk_prug_cover_photo FOREIGN KEY (cover_photo_id)
  REFERENCES prug_photos(id) ON DELETE SET NULL;


-- ============================================================================
-- FRAUD DETECTION REPORTS
-- ============================================================================

CREATE TABLE prug_forensic_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,
  risk_score INT NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  verdict VARCHAR(10) NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage JSONB,
  registry_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  vision_model VARCHAR(60),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_prug_verdict CHECK (verdict IN ('pass','review','fail'))
);

CREATE INDEX idx_prug_reports_carpet ON prug_forensic_reports(carpet_id, created_at DESC);


-- ============================================================================
-- OWNERSHIP / PROVENANCE
-- ============================================================================

CREATE TABLE prug_ownership_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,

  -- Null for historical owners who never held a Prug account
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_name VARCHAR(160) NOT NULL,
  owner_country VARCHAR(80),

  acquisition_type VARCHAR(20) NOT NULL,
  acquired_at TIMESTAMP,
  released_at TIMESTAMP,
  is_current BOOLEAN NOT NULL DEFAULT false,

  -- True only when Prug verified this party's identity at handover
  verified BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(20) NOT NULL,
  notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_prug_acquisition CHECK (
    acquisition_type IN ('original_weaver','purchase','inheritance','gift','auction','trade','unknown')
  ),
  CONSTRAINT chk_prug_ownership_source CHECK (source IN ('declared','kyc_verified','platform_transfer'))
);

CREATE INDEX idx_prug_ownership_carpet ON prug_ownership_records(carpet_id);
-- At most one current owner per carpet
CREATE UNIQUE INDEX idx_prug_ownership_current ON prug_ownership_records(carpet_id) WHERE is_current;


-- ============================================================================
-- TRANSFERS
-- ============================================================================

CREATE TABLE prug_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_email VARCHAR(255) NOT NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  message TEXT,
  price_amount VARCHAR(40),
  price_currency VARCHAR(5),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  CONSTRAINT chk_prug_transfer_status CHECK (status IN ('pending','accepted','declined','cancelled','expired'))
);

CREATE INDEX idx_prug_transfers_carpet ON prug_transfers(carpet_id);
CREATE INDEX idx_prug_transfers_to_email ON prug_transfers(to_email) WHERE status = 'pending';
-- Only one open transfer per carpet
CREATE UNIQUE INDEX idx_prug_transfers_pending ON prug_transfers(carpet_id) WHERE status = 'pending';


-- ============================================================================
-- TAMPER-EVIDENT LEDGER
-- Each event hashes its payload and the previous event; editing history breaks
-- every link after the edit.
-- ============================================================================

CREATE TABLE prug_ledger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  prev_hash CHAR(64) NOT NULL,
  event_hash CHAR(64) NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(carpet_id, sequence),
  UNIQUE(event_hash)
);

CREATE INDEX idx_prug_ledger_carpet ON prug_ledger_events(carpet_id, sequence);


-- ============================================================================
-- TOKENS / ON-CHAIN ANCHORS
-- ============================================================================

CREATE TABLE prug_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpet_id UUID NOT NULL REFERENCES prug_carpets(id) ON DELETE CASCADE,
  chain VARCHAR(20) NOT NULL,
  network VARCHAR(20) NOT NULL,
  standard VARCHAR(10) NOT NULL,
  contract_address VARCHAR(66),
  token_id VARCHAR(80),
  token_uri TEXT,
  metadata_hash VARCHAR(66) NOT NULL,
  document_hash VARCHAR(66) NOT NULL,
  anchor_tx_hash VARCHAR(80),
  status VARCHAR(12) NOT NULL DEFAULT 'prepared',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_prug_token_standard CHECK (standard IN ('erc721','anchor')),
  CONSTRAINT chk_prug_token_status CHECK (status IN ('prepared','submitted','confirmed','failed'))
);

CREATE INDEX idx_prug_tokens_carpet ON prug_tokens(carpet_id, created_at DESC);
CREATE INDEX idx_prug_tokens_document_hash ON prug_tokens(document_hash);


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE prug_carpets IS 'Registered handwoven carpets with their AI-extracted identity document';
COMMENT ON TABLE prug_photos IS 'Guided capture set; sha256 for exact duplicates, dhash/phash for perceptual matching';
COMMENT ON TABLE prug_forensic_reports IS 'Fraud-detection runs: metadata, cross-photo, registry and vision findings';
COMMENT ON TABLE prug_ownership_records IS 'Chain of custody; verified=false marks owners declared but not checked by Prug';
COMMENT ON TABLE prug_ledger_events IS 'Hash-linked event log making a carpet history tamper-evident';
COMMENT ON TABLE prug_tokens IS 'ERC-721 deeds and contract-free document-hash anchors';

COMMENT ON COLUMN prug_photos.band0 IS '16-bit slice of dhash for locality-sensitive candidate lookup';
COMMENT ON COLUMN prug_ledger_events.event_hash IS 'sha256(prev_hash|carpet_id|sequence|event_type|payload_hash|created_at)';
