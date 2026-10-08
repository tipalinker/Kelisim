# Kelisim (Келісім)

> **AI contract trap detection and immutable proof-of-existence verification on the Solana blockchain.**

**Target Audience:** Small and medium-sized business owners, entrepreneurs, and tenants in Kazakhstan who negotiate and sign commercial contracts without dedicated legal teams.

---

## Problem

- **Hidden Contract Traps:** Commercial agreements (leases, supply contracts, contractor agreements) frequently contain predatory clauses—unilateral rent increases, disproportionate security deposits, and harsh auto-renewals.
- **High Legal Costs:** Hiring contract lawyers for every revision is slow and prohibitive for small businesses and solo founders.
- **Post-Signing Alterations & Disputes:** After signing, parties frequently dispute which draft was finalized, or one party disputes the exact document version.

---

## Solution

1. **Automated Clause Risk Assessment:** Analyzes agreements to highlight high-risk clauses, calculate real monetary impact in tenge (₸), and provide actionable revision suggestions.
2. **Counterparty Letter Generator:** Generates structured, polite counter-proposals with compromise terms ready to send to the counterparty.
3. **Zero-Knowledge Document Stamping:** Computes SHA-256 hashes locally in the browser so confidential business terms never leave the client device.
4. **Permanent Digital Verification Certificate:** Produces a verifiable digital receipt with transaction signatures, timestamps, and Explorer links.

---

## How it uses Solana

- **Network:** Solana Devnet.
- **Mechanism:** [SPL Memo Program](https://spl.solana.com/memo) (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).
- **What is recorded on-chain:**
  ```text
  Kelisim v1 | sha256:<64_character_hex_hash>
  ```
- **Why Solana Devnet:**
  - **Zero Privacy Leakage:** Only the cryptographic SHA-256 digest is sent on-chain; sensitive commercial terms, party names, and confidential pricing remain 100% private.
  - **Tamper-Evident Timestamp:** Solana’s high-throughput ledger establishes irreversible proof that this exact document existed at a specific block time.
  - **Decentralized Verification:** Anyone can independently verify contract integrity via the Solana Explorer without trusting centralized third-party servers.
  - **Phantom Wallet Integration:** Users sign transactions directly through Phantom with sub-second confirmation and negligible fees.

---

## How to run

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- [Phantom Wallet](https://phantom.app/) browser extension configured to **Solana Devnet** with test SOL from [solfaucet.com](https://solfaucet.com/)

### Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd kelisim
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## Team / Команда

- **Rasim Musayev** — Founder & Lead Developer (`rasimmusaev2007@gmail.com`)
- **Fatima Panabek** — Универсал
- **Багдан Орынбасар** — Универсал
- **Алишер Балгалий** — Универсал
- **Нуржигит Кайратулы** — Универсал
