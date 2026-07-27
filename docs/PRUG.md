# Prug — carpet identity agent

**شناسنامه فرش دستبافت** — an identity, provenance and anti-fraud registry for handwoven carpets.

Anyone in the world who owns a handwoven carpet can photograph it, have an identity document built from those photographs, name the owners who came before them, and hand the carpet on to a verified buyer with its history intact. The certificate travels with the carpet, not with the seller's word.

- Backend module: `apps/backend/src/prug/`
- Schema: `apps/backend/sql/prug-schema.sql`
- API prefix: `/prug`

---

## The flow

```
 draft ──► guided capture (10–20 photos) ──► analysis ──► certificate ──► transfer ──► tokenisation
             │                                  │             │              │
             └ per-photo forensics              │             └ KYC gate     └ two-sided, KYC on both ends
                                                │
                                                ├ layer 1  deterministic (metadata, cross-photo, registry)
                                                ├ layer 2  vision (coverage, manipulation, identity)
                                                └ layer 3  risk score → pass / review / fail
```

Analysis is a fixed pipeline, not a free-running loop. Deterministic checks run first and the model never gets to overrule them — a hash collision against another owner's carpet fails the registration no matter how convincing the photographs look. Every decision replays from the stored findings.

---

## 1. Guided capture

Ten required frames, up to ten optional ones (`GET /prug/capture-plan` returns the full plan with Persian and English guidance):

| Shot | Count | Why it is required |
|---|---|---|
| `full_front` | 1 | Overall design, proportions |
| `full_back` | 1 | Knot structure, repairs, foundation |
| `corner` | 4 | Border pattern and corner wear on every side |
| `fringe_end` | 2 | Warp finish at both ends |
| `knot_macro` | 1–3 | Knot type and density — the identifying detail |
| `pile_macro` | 1–3 | Fibre, sheen, dye behaviour |

Optional: `edge_selvedge`, `signature`, `field_detail`, `defect` (up to 6), `label`, `measurement`.

Photos are uploaded one at a time as base64 JPEG or PNG. Each upload returns its forensic findings immediately, so a client can prompt for a retake while the owner is still standing over the carpet.

**HEIC and WebP are rejected.** They cannot be decoded for fingerprinting without a native dependency, and a photo that cannot be fingerprinted cannot be checked for duplicates. Convert to JPEG client-side. Upload at **2576 px on the long edge** — that is the model's high-resolution limit, and larger files are stored but excluded from the visual review.

---

## 2. Fraud detection

### Layer 1 — deterministic (no model, no network)

Implemented from the raw bytes in `src/prug/forensics/`; no image libraries.

**Per photo** (`image-metadata.ts`)

| Finding | Signal |
|---|---|
| `ai_generated_marker` | Midjourney / Stable Diffusion / Firefly / C2PA synthetic-media tags — **critical, always fails** |
| `editor_software` | EXIF `Software` naming Photoshop, GIMP, Affinity, retouching apps |
| `xmp_edit_history` | XMP records an edit history after capture |
| `adobe_processing_marker` | APP13 Photoshop IRB / APP14 Adobe markers |
| `thumbnail_mismatch` | The embedded EXIF preview no longer matches the image it previews |
| `dimension_mismatch` | EXIF pixel dimensions disagree with the JPEG frame (cropped or resized) |
| `post_capture_modification` | File last written long after `DateTimeOriginal` |
| `no_exif` / `no_camera_identity` | Metadata stripped — screenshot, download, messaging app |
| `png_source` | Cameras do not produce PNG |
| `low_resolution` | Below 1000 px (1400 px for macro shots) |
| `heavy_recompression` | Estimated JPEG quality under 60 |

**Across the set** (`forensics.service.ts`)

`duplicate_photo` (same file twice), `near_duplicate_photo` (one image re-saved for two different shots), `mixed_capture_devices` (three or more cameras), `implausible_capture_span` (photos taken over more than a year), `no_capture_timeline`.

**Against the registry**

Every photo carries a 64-bit dHash and pHash. Four indexed 16-bit bands make near-duplicate lookup selective without scanning the table; exact Hamming distance is computed on the candidates.

- match on the registrant's own carpet → `duplicate_registration_same_owner` (medium)
- match on **another owner's** carpet → `duplicate_registration_other_owner` (**critical**) — the strongest signal that someone is registering a rug they do not hold

### Layer 2 — vision (Claude, `claude-opus-5`)

Three separate passes, each with its own system prompt and JSON schema, so an appealing carpet cannot talk the fraud check into a pass:

1. **Coverage** — does each photo show what it claims, and do all of them show the *same* carpet?
2. **Manipulation** — retouching, splicing, synthetic imagery, photo-of-a-screen, photo-of-a-print, watermark removal. The prompt explicitly rules out false positives: abrash, crooked borders and uneven knot rows are normal weaving; repairs are carpet history, not image tampering.
3. **Identity** — the cataloguing pass that produces the شناسنامه.

Structured outputs constrain every response; refusals, `max_tokens` stops and unparseable output are recorded as *inconclusive* and route the carpet to manual review — never to a silent pass. Server-side fallbacks (`fallbacks: "default"`) are enabled by default so a safety refusal is retried on Anthropic's recommended model; if the account rejects the parameter the service drops it and carries on.

Without `ANTHROPIC_API_KEY` the passes are skipped and every carpet lands in manual review.

### Layer 3 — scoring

Findings are weighted and summed with diminishing returns (`w × 0.85ⁿ`), so a pile of minor signals cannot outweigh one decisive finding. Any critical finding floors the score at 85.

| Score | Level | Verdict |
|---|---|---|
| 0–19 | low | `pass` → certificate issued |
| 20–44 | medium | `review` |
| 45–74 | high | `review` |
| 75–100 | severe | `fail` |

---

## 3. Identity document

The vision pass grounds every field in the photographs and is told to say "cannot be determined from these photographs" rather than guess. It treats the owner's declaration as a claim to check — contradictions land in `declarationConflicts` and become a finding.

Fields: origin country and region, design family, motifs, knot type and density, pile/warp/weft materials, dye assessment, age range, dominant colours, dimensions, condition, defects, **distinguishing marks** (the features that make this carpet identifiable rather than typical), and summaries in English and Persian.

**Certificate number** — `PRUG-7QK3M9WX-482`. Deterministic from the carpet id, Crockford base32 (no I/L/O/U), with a checksum that catches transcription errors.

**Document hash** — a fold over the photo digests, the identity document and the ledger head. It proves a certificate describes *these* photographs and no others.

---

## 4. KYC

Drafting and photographing are open so a new user can see the flow. Identity verification (the existing `users.kyc_status`) is required at the two moments the platform makes an assertion about a person:

- issuing a certificate
- both sides of an ownership transfer, and tokenisation

If analysis passes but the owner has not verified, the carpet is marked `verified` and the certificate waits — `analyze` returns `certificatePendingReason`. Set `PRUG_KYC_REQUIRED=false` in development only.

---

## 5. Provenance

Two kinds of owner, and the distinction is preserved forever and shown publicly:

| Source | Meaning |
|---|---|
| `declared` | A historical owner the registrant named. Prug did not verify them. |
| `kyc_verified` / `platform_transfer` | A party Prug identity-checked at the time of the handover. |

A buyer can therefore see exactly which links in the chain the platform stands behind.

**Transfers are two-sided.** The owner opens a transfer addressed to an email; nothing moves until the recipient — who must be KYC-verified and must be the addressed account — accepts. Transfers expire after 30 days, and only one can be open per carpet.

**Tamper-evident ledger.** Every event (registration, analysis, certificate, declared owner, each transfer step, tokenisation) is hashed with its payload and the previous event's hash. Editing history breaks every link after the edit. `GET /prug/carpets/:id/ledger` returns the events plus a recomputed verification, and the public profile shows whether the chain is intact.

---

## 6. Public profile

Every carpet gets a shareable profile at a readable address — `tabriz-medallion-7qk3m9` — reachable by slug or by certificate number, with no session:

- identity document and photo gallery (per-photo visibility is the owner's choice)
- chain of custody, with verified and declared links distinguished
- ledger integrity and risk level
- on-chain anchor or token, if any

Visibility is `public`, `unlisted` or `private`. Owner identity is reduced to a display name — the registry proves the chain of custody without publishing who holds the rug today.

---

## 7. Tokenisation

Both modes are driven by the same document hash, and neither is required for a certificate to be valid:

- **anchor** (default) — a zero-value transaction whose calldata is `PRUG1` + the document hash. Contract-free; enough to prove the certificate existed in this exact form at that block.
- **erc721** — with `PRUG_NFT_CONTRACT` set, mints a transferable deed via `safeMint(address,string)`, with the profile's metadata endpoint as its token URI.

`GET /prug/carpets/:id/token` returns the exact metadata and hashes that *would* go on chain, without a signer. When no key is configured that plan is still produced, so an owner can see what would be published before any key is involved.

> On-chain transfer and the registry's own ownership record are separate. Moving an NFT does not move the Prug record — the platform transfer flow, with KYC on both ends, remains the source of truth for custody.

---

## API

All owner routes require a bearer token.

| Method | Path | |
|---|---|---|
| `GET` | `/prug/capture-plan` | Shot list with bilingual guidance |
| `GET` | `/prug/kyc-status` | Verification state and whether the gate is enforced |
| `POST` | `/prug/carpets` | Create a draft |
| `GET` | `/prug/carpets` | List own carpets |
| `GET` | `/prug/carpets/:id` | Carpet, photos, ownership, latest report, token |
| `PATCH` | `/prug/carpets/:id/profile` | Visibility, story, cover photo |
| `POST` | `/prug/carpets/:id/photos` | Upload one photo; returns findings + coverage |
| `GET` | `/prug/carpets/:id/photos` | List photos with their findings |
| `GET` | `/prug/carpets/:id/photos/:photoId/raw` | Photo bytes (owner) |
| `DELETE` | `/prug/carpets/:id/photos/:photoId` | Remove a photo (before certification) |
| `POST` | `/prug/carpets/:id/analyze` | Run the agent |
| `POST` | `/prug/carpets/:id/certificate` | Issue the certificate (KYC) |
| `GET` | `/prug/carpets/:id/ledger` | Events + integrity verification |
| `GET`/`POST` | `/prug/carpets/:id/owners` | Chain of custody / declare a previous owner |
| `POST` | `/prug/carpets/:id/transfers` | Open a transfer (KYC) |
| `GET` | `/prug/transfers/incoming` | Transfers addressed to you |
| `POST` | `/prug/transfers/:id/accept` `/decline` `/cancel` | Respond to a transfer |
| `GET`/`POST` | `/prug/carpets/:id/token` | Tokenisation plan / execute (KYC) |

Public:

| Method | Path | |
|---|---|---|
| `GET` | `/prug/profiles/:slug` | Public carpet profile |
| `GET` | `/prug/profiles/:slug/photos/:photoId` | Public photo bytes |
| `GET` | `/prug/profiles/:slug/metadata` | ERC-721 `tokenURI` document |
| `GET` | `/prug/verify/:certificateNumber` | Look up by printed certificate number |

### Example

```bash
# 1. Draft
curl -X POST $API/prug/carpets -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Tabriz medallion","declared":{"originRegion":"Tabriz","materials":["wool","cotton"],"lengthCm":300,"widthCm":200}}'

# 2. Upload each frame
curl -X POST $API/prug/carpets/$ID/photos -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"shotType\":\"full_front\",\"data\":\"$(base64 -w0 front.jpg)\"}"

# 3. Run the agent once the set is complete
curl -X POST $API/prug/carpets/$ID/analyze -H "Authorization: Bearer $TOKEN"

# 4. Anyone can check the result
curl $API/prug/verify/PRUG-7QK3M9WX-482
```

---

## Configuration

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Without it, vision passes are skipped and everything goes to manual review |
| `PRUG_AI_MODEL` | `claude-opus-5` | |
| `PRUG_AI_EFFORT` | `high` | `low` … `max` |
| `PRUG_AI_FALLBACKS` | `true` | Server-side refusal fallbacks |
| `PRUG_STORAGE_DIR` | `./storage/prug` | Photo storage root |
| `PRUG_KYC_REQUIRED` | `true` | Development escape hatch only |
| `PRUG_PUBLIC_URL` | `https://prug.app` | Base URL in token metadata |
| `PRUG_ANCHOR_PRIVATE_KEY` | — | Without it, tokenisation returns unsigned plans |
| `PRUG_NFT_CONTRACT` | — | Set to mint ERC-721 instead of anchoring |
| `PRUG_ANCHOR_ADDRESS` | `0x…dEaD` | Anchor transaction sink |
| `MAX_REQUEST_SIZE` | `15mb` | JSON body limit for photo uploads |

Reuses `DATABASE_URL`, `TESTNET_MODE`, `ETH_RPC_URL` / `ETH_TESTNET_RPC_URL`.

Apply the schema after the base one:

```bash
psql $DATABASE_URL -f apps/backend/sql/schema.sql
psql $DATABASE_URL -f apps/backend/sql/prug-schema.sql
```

---

## Implementation notes

**Everything image-related is dependency-free TypeScript.** EXIF/TIFF, the JPEG marker walker, the PNG chunk reader (Node's `zlib` does the inflate), a baseline **JPEG DC-only decoder**, and both perceptual hashes are implemented from the byte layouts in `src/prug/forensics/`.

The DC decoder is the interesting one: fingerprinting only needs each 8×8 block's average brightness, which *is* its DC coefficient. Entropy-decoding the scan and skipping the IDCT yields a 1/8-scale greyscale image at a fraction of the work — and with no native dependency to build in the Docker image. Progressive JPEGs return null, and a photo with no fingerprint is treated as "cannot verify", never as "clean".

Tests build valid PNG and JPEG containers byte by byte, including a small **baseline JPEG encoder** with canonical Huffman tables, so the decoder is exercised against real entropy-coded data rather than a checked-in binary.

### Known limits

- Near-duplicate lookup fetches banded candidates and computes distance in the service. Fine into the millions of photos; beyond that it wants a dedicated vector or LSH index.
- No ELA or JPEG ghost analysis — both need a re-encoder. Splice detection is left to the vision pass.
- C2PA claims are detected but not cryptographically verified.
- A photo that cannot be decoded (progressive JPEG) is scored as unverifiable rather than blocked.
