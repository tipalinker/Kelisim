# Kelisim

**What it does:** Analyzes commercial contracts for hidden risk traps and anchors immutable SHA-256 document fingerprints onto the Solana blockchain.

**Target audience:** Small and medium-sized business owners, entrepreneurs, and tenants who negotiate agreements without in-house legal teams.

**Solana Devnet Record:** Cryptographic SHA-256 hash formatted as `Kelisim v1 | sha256:<hash>` recorded via the SPL Memo program to provide tamper-proof proof-of-existence without exposing confidential contract contents.

---

## Problem

- **Hidden Contract Traps:** Commercial agreements (leases, supplier contracts, service agreements) routinely include predatory clauses such as unilateral fee increases, disproportionate penalties, and automatic lock-ins.
- **Prohibitive Legal Costs:** Hiring contract lawyers for every draft revision is slow and expensive for small businesses and solo founders.
- **Post-Signing Alterations & Disputes:** Counterparties often dispute which draft was finalized or claim that clauses were modified after signing.

---

## Solution

- **Automated Clause Risk Assessment:** Identifies predatory clauses, estimates potential monetary exposure in Kazakhstani tenge (₸), and provides concrete revision recommendations.
- **Counterparty Letter Generator:** Generates structured, polite counter-proposals with balanced compromise terms ready to send to counterparties.
- **Client-Side SHA-256 Stamping:** Computes document hashes locally in the browser so confidential business terms never leave the user's device.
- **Verifiable Proof-of-Existence Certificate:** Produces a downloadable, tamper-evident digital certificate with transaction signature, timestamp, and Solana Explorer link.

---

## How it uses Solana

- **Network:** Solana Devnet.
- **Program:** [SPL Memo Program](https://spl.solana.com/memo) (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).
- **On-chain record:**
  ```text
  Kelisim v1 | sha256:<64_character_hex_hash>
  ```
- **Why Solana:**
  - **Zero Privacy Leakage:** Confidential terms, names, and pricing stay completely private; only the one-way cryptographic SHA-256 digest is published.
  - **Tamper-Evident Timestamp:** Records immutable proof that this exact document existed at a specific block time.
  - **Independent Verification:** Anyone can independently verify contract authenticity via Solana Explorer without relying on centralized servers.
  - **Fast & Inexpensive:** Sub-second confirmation and near-zero transaction fees signed via Phantom Wallet.

---

## How to run

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- [Phantom Wallet](https://phantom.app/) browser extension set to **Solana Devnet** with test SOL from [solfaucet.com](https://solfaucet.com/)

### Setup & Launch

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

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY if testing AI contract analysis
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## Team

- **Rasim Musayev** — Founder & Lead Developer
- **Fatima Panabek** — Generalist & Operations
- **Bagdan Orynbassar** — Generalist & Product
- **Alisher Balgaliy** — Generalist & Frontend
- **Nurzhigit Kairatuly** — Generalist & Legal Domain
