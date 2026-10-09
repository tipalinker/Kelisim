# Kelisim

> **Intelligent contract risk mitigation & tamper-proof blockchain notarization.**

Kelisim protects **small businesses, entrepreneurs, and lawyers** during contract negotiations by detecting hidden legal traps, generating ready-to-send counterparty negotiation letters, and anchoring immutable cryptographic document fingerprints directly onto the **Solana blockchain**.

---

## Problem

- **Hidden Legal Traps:** Commercial agreements (commercial leases, vendor agreements, supply contracts) frequently conceal one-sided risks — uncapped liability, unilateral price revisions, automatic lock-ins, and asymmetric termination penalties.
- **High Legal Overhead & Delays:** Small businesses and founders often cannot afford dedicated legal counsel for every revision, while busy lawyers spend excessive hours auditing standard boilerplate text.
- **Draft Disputes & Post-Signing Tampering:** Disagreements routinely arise over which draft version was approved, with counterparties altering subtle wording before signing or denying prior agreements.

---

## Solution

1. **Trap Detection & Risk Scoring:** Instantly flags predatory terms, ranks risk severity, and estimates potential financial exposure.
2. **Counterparty Response Generator:** Drafts professional, legally sound counter-proposals and negotiation letters with balanced compromise terms.
3. **Zero-Knowledge SHA-256 Hashing:** Computes the document's 256-bit cryptographic digest entirely client-side; confidential business terms and personal data never leave the browser.
4. **Verifiable Proof-of-Existence Certificate:** Generates a downloadable proof certificate containing the Solana transaction signature, block timestamp, and direct Solana Explorer verification link.

---

## How it uses Solana

### What is Recorded On-Chain
Kelisim writes a standardized cryptographic record via the native [SPL Memo Program](https://spl.solana.com/memo) (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) on **Solana Devnet**:

```text
Kelisim v1 | sha256:<64-character-hex-digest>
```

### Why Solana & On-Chain Hashing?
- **100% Privacy by Design:** The contract's contents, parties, and figures are never broadcast to the ledger. Only the one-way SHA-256 mathematical hash is published.
- **Immutable Proof of Existence (PoE):** Anchors an unalterable timestamp and block height, proving the exact contract draft existed in that specific form at that precise second.
- **Zero Ambiguity in Disputes:** Altering a single comma, digit, or appendix generates a completely different hash. Counterparties can never substitute pages or claim post-hoc changes.
- **Trustless & Independent Verification:** Anyone can independently verify the contract draft on Solana Explorer in under a second — with no dependency on Kelisim's servers, private databases, or trusted third parties.
- **Speed & Negligible Cost:** Solana’s 400ms slot times and fraction-of-a-cent fees make notarization instantaneous via Phantom Wallet.

---

## How to run

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- [Phantom Wallet](https://phantom.app/) browser extension configured to **Solana Devnet** (with free test SOL from [solfaucet.com](https://solfaucet.com/))

### Installation & Development

```bash
# 1. Clone the repository
git clone <repo-url>
cd kelisim

# 2. Install dependencies
npm install
# or: bun install

# 3. Configure environment variables
cp .env.example .env
# Set GEMINI_API_KEY in .env for AI contract analysis

# 4. Start local development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build

```bash
npm run build
```

---

## Team

- **Rasim Musayev** — Founder & Lead Developer
- **Fatima Panabek** — Operations & Legal Strategy
- **Bagdan Orynbassar** — Product & Analytics
- **Alisher Balgaliy** — Frontend Engineering
- **Nurzhigit Kairatuly** — Legal Domain & Compliance
