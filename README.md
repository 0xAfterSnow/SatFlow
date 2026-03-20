# SatFlow — Bitcoin Yield Routing Protocol

> "Bitcoin is no longer idle capital."

SatFlow is a Bitcoin-native yield routing protocol built on Stacks that enables users to deploy BTC (via sBTC) into diversified yield strategies, blending sBTC growth with USDCx stability.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Blockchain | Stacks (Clarity smart contracts) |
| Wallet | Hiro Wallet via `@stacks/connect` |
| Charts | Recharts |

---

## Project Structure

```
satflow/
├── contracts/
│   ├── vault.clar        # Stores deposits, handles withdrawals
│   ├── router.clar       # Allocation engine, rebalancing logic
│   └── strategy.clar     # Mock yield simulation layer
├── src/
│   ├── context/
│   │   └── SatFlowContext.tsx   # Stacks wallet + contract state
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── StrategyCard.tsx
│   │   └── WithdrawModal.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── DepositPage.tsx
│   │   └── DashboardPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Build for production

```bash
npm run build
```

---

## Smart Contracts

The three Clarity contracts are in `/contracts`. Deploy them to Stacks testnet using Clarinet or the Hiro Platform.

### vault.clar
- Accepts sBTC deposits (STX on testnet as proxy)
- Tracks user balances on-chain
- Handles withdrawals, returning principal to user
- Stores strategy label and deposit timestamp

### router.clar
- Manages allocation ratios (basis points)
- Handles strategy selection: `conservative`, `balanced`, `aggressive`
- Executes rebalancing logic when user switches strategy
- Emits split amounts for sBTC and USDCx

### strategy.clar
- Mock yield simulation layer
- Returns APY ranges per strategy per asset
- Computes expected yield for given block ranges
- Designed to be swapped for real protocol integrations (Arkadiko, Zest, etc.)

---

## Deploying Contracts

### Using Clarinet

```bash
# Install Clarinet
brew install clarinet  # or see https://docs.hiro.so/clarinet/

# Initialize project (if not done)
clarinet new satflow-contracts

# Copy contracts into contracts/ folder

# Check contracts
clarinet check

# Deploy to testnet
clarinet deployments apply --testnet
```

### Update Contract Address

After deploying, update `SatFlowContext.tsx`:

```ts
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_ADDRESS';
const VAULT_CONTRACT = 'satflow-vault';
const ROUTER_CONTRACT = 'satflow-router';
const STRATEGY_CONTRACT = 'satflow-strategy';
```

---

## Yield Strategies

| Strategy | sBTC | USDCx | sBTC APY | USDCx APY | Blended APY |
|----------|------|-------|----------|-----------|-------------|
| Conservative | 20% | 80% | 8–10% | 4–6% | ~6.4% |
| Balanced | 50% | 50% | 10–13% | 5–7% | ~8.75% |
| Aggressive | 80% | 20% | 12–15% | 6–8% | ~11.8% |

---

## Features

- **Wallet Connection** — Hiro Wallet via `@stacks/connect`
- **Deposit Flow** — BTC amount input → strategy selection → on-chain vault deposit
- **Real-time Yield** — Yield accrues every second in the UI (simulated, mirrors contract math)
- **Dashboard** — Live portfolio value, yield breakdown, allocation pie chart, performance area chart
- **Rebalance** — Switch strategies mid-position via `router.clar`
- **Withdraw** — Full exit with yield summary via `vault.clar`

---

## What's Real vs Simulated

| Feature | Real |
|---------|------|
| On-chain contract state | ✅ Real (Stacks testnet) |
| Wallet signing | ✅ Real (Hiro Wallet) |
| Yield math | ✅ Real (mirrors contract APY formulas) |
| BTC price feed | 🟡 Mocked ($67,420 — replace with oracle in prod) |
| Actual BTC transfer back | 🟡 Simulated (bridging infra out of scope) |
| External protocol integrations | 🟡 Mocked (Arkadiko/Zest integration points stubbed) |

---

## Environment

No `.env` file required for testnet. The app targets **Stacks testnet** by default.

To switch to mainnet, change in `SatFlowContext.tsx`:

```ts
import { STACKS_MAINNET } from '@stacks/network';
const NETWORK = STACKS_MAINNET;
const API_BASE_URL = 'https://api.mainnet.hiro.so';
```

---

## License

MIT
