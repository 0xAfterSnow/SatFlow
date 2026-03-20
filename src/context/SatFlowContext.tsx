import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { connect, disconnect, isConnected, getLocalStorage, openContractCall } from '@stacks/connect';
import { STACKS_TESTNET } from '@stacks/network';
import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  principalCV,
  contractPrincipalCV,
  stringAsciiCV,
  PostConditionMode,
} from '@stacks/transactions';

// ─── Network config ───────────────────────────────────────────────
const NETWORK = STACKS_TESTNET;
const API_BASE_URL = 'https://api.testnet.hiro.so';

// ─── Contract addresses ───────────────────────────────────────────
const CONTRACT_ADDRESS = 'ST1X96N4Y6TNRRMHWA9G252P5CCMZECGTF82FR086';
const VAULT_CONTRACT = 'satflow-vault';
const ROUTER_CONTRACT = 'satflow-router';
const STRATEGY_CONTRACT = 'satflow-strategy';

// sBTC SIP-010 token — already deployed on Stacks testnet by Trust Machines / Hiro
// No need to deploy your own — just reference the existing contract
const SBTC_TOKEN_ADDRESS = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';
const SBTC_TOKEN_NAME = 'sbtc-token';
// sBTC uses 8 decimal places (satoshis): 1 sBTC = 100,000,000 sats
const SATS_PER_BTC = 100_000_000;

// ─── Strategy definitions ─────────────────────────────────────────
export const STRATEGIES = {
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    sbtcPct: 20,
    usdcxPct: 80,
    sbtcApy: { min: 8, max: 10 },
    usdcxApy: { min: 4, max: 6 },
    description: 'Stability-first: maximize USDCx yield with minimal BTC exposure.',
    riskLevel: 1,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    sbtcPct: 50,
    usdcxPct: 50,
    sbtcApy: { min: 10, max: 13 },
    usdcxApy: { min: 5, max: 7 },
    description: 'Equal split between growth and stability for diversified returns.',
    riskLevel: 2,
  },
  aggressive: {
    id: 'aggressive',
    label: 'Aggressive',
    sbtcPct: 80,
    usdcxPct: 20,
    sbtcApy: { min: 12, max: 15 },
    usdcxApy: { min: 6, max: 8 },
    description: 'Growth-maximizing: heavy sBTC allocation for maximum BTC upside.',
    riskLevel: 3,
  },
} as const;

export type StrategyId = keyof typeof STRATEGIES;

// ─── Types ────────────────────────────────────────────────────────
export interface UserPosition {
  depositedBtc: number;       // BTC deposited (simulated)
  depositedSbtc: number;      // sBTC (same as BTC 1:1)
  strategyId: StrategyId;
  sbtcAllocation: number;     // USD value in sBTC
  usdcxAllocation: number;    // USD value in USDCx
  yieldEarned: number;        // Total yield earned USD
  sbtcYield: number;
  usdcxYield: number;
  depositTimestamp: number;   // ms since epoch
  currentApy: number;         // blended APY
  btcPriceAtDeposit: number;
}

export interface YieldSnapshot {
  timestamp: number;
  totalValue: number;
  yieldEarned: number;
}

interface SatFlowContextType {
  // Wallet
  connected: boolean;
  address: string | null;
  balance: number | null;
  isLoading: boolean;
  error: string | null;

  // Position
  position: UserPosition | null;
  yieldHistory: YieldSnapshot[];
  btcPrice: number;

  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  fetchBalance: () => Promise<void>;
  deposit: (btcAmount: number, strategyId: StrategyId) => Promise<void>;
  rebalance: (newStrategyId: StrategyId) => Promise<void>;
  withdraw: () => Promise<{ deposit: number; yield: number; total: number } | null>;
  formatAddress: (address: string | null) => string;

  // Helpers
  getBlendedApy: (strategyId: StrategyId) => number;
  getLivePortfolioValue: () => number;
}

const SatFlowContext = createContext<SatFlowContextType | undefined>(undefined);

export const useSatFlow = (): SatFlowContextType => {
  const ctx = useContext(SatFlowContext);
  if (!ctx) throw new Error('useSatFlow must be used within SatFlowProvider');
  return ctx;
};

// ─── Simulated BTC price (in production: fetch from oracle) ───────
const MOCK_BTC_PRICE = 67_420;

// ─── Yield accrual: runs every second, simulates real-time yield ──
function accrueYield(position: UserPosition, btcPrice: number): UserPosition {
  const now = Date.now();
  const elapsedSeconds = (now - position.depositTimestamp) / 1000;
  const strategy = STRATEGIES[position.strategyId];

  // Pick midpoint APY for each asset
  const sbtcApy = (strategy.sbtcApy.min + strategy.sbtcApy.max) / 2 / 100;
  const usdcxApy = (strategy.usdcxApy.min + strategy.usdcxApy.max) / 2 / 100;

  const sbtcUsdValue = position.sbtcAllocation * btcPrice;
  const usdcxUsdValue = position.usdcxAllocation;

  const sbtcYield = sbtcUsdValue * sbtcApy * (elapsedSeconds / (365 * 24 * 3600));
  const usdcxYield = usdcxUsdValue * usdcxApy * (elapsedSeconds / (365 * 24 * 3600));

  const totalUsd = sbtcUsdValue + usdcxUsdValue;
  const blendedApy = totalUsd > 0
    ? ((sbtcUsdValue * sbtcApy) + (usdcxUsdValue * usdcxApy)) / totalUsd * 100
    : 0;

  return {
    ...position,
    sbtcYield,
    usdcxYield,
    yieldEarned: sbtcYield + usdcxYield,
    currentApy: blendedApy,
  };
}

// ─── Provider ─────────────────────────────────────────────────────
const POSITION_STORAGE_KEY = 'satflow-position';

function savePosition(pos: UserPosition | null) {
  try {
    if (pos) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
    } else {
      localStorage.removeItem(POSITION_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

function loadPosition(): UserPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserPosition;
  } catch {
    return null;
  }
}

// Fetch current Stacks block height (best-effort; falls back to 0)
async function fetchCurrentBlockHeight(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/v2/info`);
    const data = await res.json();
    return data.stacks_tip_height ?? 0;
  } catch {
    return 0;
  }
}

export const SatFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seed from localStorage for instant render; will be overridden by on-chain truth
  const [position, setPosition] = useState<UserPosition | null>(loadPosition);
  const [yieldHistory, setYieldHistory] = useState<YieldSnapshot[]>([]);
  const [btcPrice] = useState(MOCK_BTC_PRICE);
  const yieldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check connection on mount ──
  useEffect(() => {
    if (isConnected()) {
      setConnected(true);
      const data = getLocalStorage();
      if (data?.addresses?.stx?.[0]?.address) {
        setAddress(data.addresses.stx[0].address);
      }
    }
  }, []);

  // ── Fetch balance + on-chain position when address is known ──
  useEffect(() => {
    if (address) {
      fetchBalance();
      fetchPositionFromChain(address);
    }
  }, [address]);

  // ── Real-time yield accrual timer ──
  useEffect(() => {
    if (position) {
      yieldTimerRef.current = setInterval(() => {
        setPosition(prev => prev ? accrueYield(prev, btcPrice) : null);
        // Snapshot every 30s for history chart
        setYieldHistory(prev => {
          const now = Date.now();
          if (prev.length === 0 || now - prev[prev.length - 1].timestamp > 30_000) {
            return [...prev, {
              timestamp: now,
              totalValue: 0, // will be computed in render
              yieldEarned: 0,
            }];
          }
          return prev;
        });
      }, 1000);
    } else {
      if (yieldTimerRef.current) clearInterval(yieldTimerRef.current);
    }
    return () => { if (yieldTimerRef.current) clearInterval(yieldTimerRef.current); };
  }, [position?.depositTimestamp, btcPrice]);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE_URL}/extended/v1/address/${address}/stx`);
      const data = await res.json();
      setBalance(parseInt(data.balance || '0') / 1_000_000);
    } catch {
      setBalance(0);
    }
  }, [address]);

  // ── Read position from chain — the authoritative source of truth ──
  const fetchPositionFromChain = useCallback(async (userAddress: string) => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: VAULT_CONTRACT,
        functionName: 'get-vault',
        functionArgs: [principalCV(userAddress)],
        network: NETWORK,
        senderAddress: userAddress,
      });

      console.log('[SatFlow] raw result:', JSON.stringify(result, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v, 2));

      // Unwrap ResponseOk if present (string-based type in newer SDK)
      const maybeUnwrapped = (result as any).type === 'ok' ? (result as any).value : result;

      // Handle None
      if ((maybeUnwrapped as any).type === 'none') {
        savePosition(null);
        setPosition(null);
        return;
      }

      // Must be Some
      if ((maybeUnwrapped as any).type !== 'some') {
        console.warn('[SatFlow] Unexpected type:', (maybeUnwrapped as any).type);
        return;
      }

      // ✅ New SDK: value.value is the tuple, fields are in value.value directly
      const tupleData: Record<string, any> = (maybeUnwrapped as any).value?.value ?? {};

      console.log('[SatFlow] tupleData:', tupleData);

      // ✅ New SDK: is-active is {type: 'true'} or {type: 'false'}
      const isActive: boolean = tupleData['is-active']?.type === 'true';

      if (!isActive) {
        savePosition(null);
        setPosition(null);
        return;
      }

      // ✅ New SDK: uint fields have .value as bigint
      const sbtcSats: number = Number(tupleData['sbtc-deposited']?.value ?? 0n);
      const depositedBtc = sbtcSats / SATS_PER_BTC;

      // ✅ New SDK: ascii fields have .value (not .data)
      const strategyRaw: string = tupleData['strategy']?.value ?? 'balanced';
      const strategyId: StrategyId = (strategyRaw in STRATEGIES)
        ? strategyRaw as StrategyId
        : 'balanced';

      const depositedAtBlock: number = Number(tupleData['deposited-at']?.value ?? 0n);

      const currentBlock = await fetchCurrentBlockHeight();
      const blocksElapsed = Math.max(0, currentBlock - depositedAtBlock);
      const depositTimestamp = Date.now() - blocksElapsed * 10_000;

      const strategy = STRATEGIES[strategyId];
      const totalUsd = depositedBtc * MOCK_BTC_PRICE;

      const usdcxOnChain = Number(tupleData['usdcx-equivalent']?.value ?? 0n);
      const sbtcAlloc = (strategy.sbtcPct / 100) * depositedBtc;
      const usdcxAlloc = usdcxOnChain > 0
        ? usdcxOnChain / 1_000_000
        : (strategy.usdcxPct / 100) * totalUsd;

      const onChainPosition: UserPosition = {
        depositedBtc,
        depositedSbtc: depositedBtc,
        strategyId,
        sbtcAllocation: sbtcAlloc,
        usdcxAllocation: usdcxAlloc,
        yieldEarned: 0,
        sbtcYield: 0,
        usdcxYield: 0,
        depositTimestamp,
        currentApy: 0,
        btcPriceAtDeposit: MOCK_BTC_PRICE,
      };

      savePosition(onChainPosition);
      setPosition(onChainPosition);
      setYieldHistory([{
        timestamp: depositTimestamp,
        totalValue: totalUsd,
        yieldEarned: 0,
      }]);

      console.log('[SatFlow] position loaded from chain:', onChainPosition);

    } catch (err) {
      console.warn('[SatFlow] fetchPositionFromChain failed:', err);
    }
  }, []);
  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await connect();
      if (response) {
        setConnected(true);
        const data = getLocalStorage();
        if (data?.addresses?.stx?.[0]?.address) {
          setAddress(data.addresses.stx[0].address);
        }
      }
    } catch {
      setError('Failed to connect wallet. Please install Hiro Wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = useCallback(() => {
    disconnect();
    try {
      localStorage.removeItem('stacks-session');
      localStorage.removeItem('blockstack-session');
      savePosition(null);
    } catch { /* ignore */ }
    setConnected(false);
    setAddress(null);
    setBalance(null);
    setError(null);
    setPosition(null);
    setYieldHistory([]);
  }, []);

  // ── Deposit: calls vault.clar → router.clar on-chain ─────────────
  const deposit = useCallback(async (btcAmount: number, strategyId: StrategyId): Promise<void> => {
    if (!address) throw new Error('Wallet not connected');

    const strategy = STRATEGIES[strategyId];
    // sBTC uses satoshi precision: 1 BTC = 100,000,000 sats
    const amountInSats = Math.floor(btcAmount * SATS_PER_BTC);

    // The vault accepts sBTC as a SIP-010 trait argument
    const sbtcTokenCV = contractPrincipalCV(SBTC_TOKEN_ADDRESS, SBTC_TOKEN_NAME);

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: VAULT_CONTRACT,
        functionName: 'deposit',
        functionArgs: [
          uintCV(amountInSats),
          stringAsciiCV(strategyId),
          sbtcTokenCV,
        ],
        network: NETWORK,
        // Allow mode: testnet sBTC mock returns ok without moving tokens,
        // so Deny mode post-conditions always fail (0 moved vs N expected).
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        onFinish: () => {
          // Create position locally (contract state mirrors this)
          const totalUsd = btcAmount * btcPrice;
          const sbtcAlloc = (strategy.sbtcPct / 100) * btcAmount; // in BTC
          const usdcxAlloc = (strategy.usdcxPct / 100) * totalUsd; // in USD

          const newPosition: UserPosition = {
            depositedBtc: btcAmount,
            depositedSbtc: btcAmount,
            strategyId,
            sbtcAllocation: sbtcAlloc,
            usdcxAllocation: usdcxAlloc,
            yieldEarned: 0,
            sbtcYield: 0,
            usdcxYield: 0,
            depositTimestamp: Date.now(),
            currentApy: 0,
            btcPriceAtDeposit: btcPrice,
          };
          savePosition(newPosition);
          setPosition(newPosition);
          setYieldHistory([{ timestamp: Date.now(), totalValue: totalUsd, yieldEarned: 0 }]);
          resolve();
        },
        onCancel: () => reject(new Error('Transaction cancelled')),
      });
    });
  }, [address, btcPrice]);

  // ── Rebalance: calls router.clar on-chain ─────────────────────────
  const rebalance = useCallback(async (newStrategyId: StrategyId): Promise<void> => {
    if (!address || !position) throw new Error('No active position');

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: ROUTER_CONTRACT,
        functionName: 'set-allocation',         // ← seed the router first
        functionArgs: [
          principalCV(address),
          uintCV(Math.floor(position.depositedBtc * SATS_PER_BTC)),
          stringAsciiCV(position.strategyId),   // current strategy to initialize
        ],
        network: NETWORK,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        onFinish: () => {
          // Now call the actual rebalance
          openContractCall({
            contractAddress: CONTRACT_ADDRESS,
            contractName: ROUTER_CONTRACT,
            functionName: 'rebalance',
            functionArgs: [stringAsciiCV(newStrategyId)],
            network: NETWORK,
            postConditionMode: PostConditionMode.Allow,
            postConditions: [],
            onFinish: () => {
              const strategy = STRATEGIES[newStrategyId];
              const totalBtc = position.depositedSbtc;
              const totalUsd = totalBtc * btcPrice;
              setPosition(prev => {
                const updated = prev ? {
                  ...prev,
                  strategyId: newStrategyId,
                  sbtcAllocation: (strategy.sbtcPct / 100) * totalBtc,
                  usdcxAllocation: (strategy.usdcxPct / 100) * totalUsd,
                } : null;
                savePosition(updated);
                return updated;
              });
              resolve();
            },
            onCancel: () => reject(new Error('Rebalance cancelled')),
          });
        },
        onCancel: () => reject(new Error('set-allocation cancelled')),
      });
    });
  }, [address, position, btcPrice]);

  // ── Withdraw: calls vault.clar on-chain ───────────────────────────
  const withdraw = useCallback(async (): Promise<{ deposit: number; yield: number; total: number } | null> => {
    if (!address || !position) throw new Error('No active position');

    const snapshot = {
      deposit: position.depositedBtc * position.btcPriceAtDeposit,
      yield: position.yieldEarned,
      total: position.depositedBtc * position.btcPriceAtDeposit + position.yieldEarned,
    };

    return new Promise((resolve, reject) => {
      const sbtcTokenCV = contractPrincipalCV(SBTC_TOKEN_ADDRESS, SBTC_TOKEN_NAME);
      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: VAULT_CONTRACT,
        functionName: 'withdraw',
        functionArgs: [
          sbtcTokenCV,           // <-- sBTC token contract (SIP-010 trait)
        ],
        network: NETWORK,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        onFinish: () => {
          savePosition(null);
          setPosition(null);
          setYieldHistory([]);
          fetchBalance();
          resolve(snapshot);
        },
        onCancel: () => reject(new Error('Transaction cancelled')),
      });
    });
  }, [address, position, fetchBalance]);

  const getBlendedApy = useCallback((strategyId: StrategyId): number => {
    const s = STRATEGIES[strategyId];
    const sbtcMid = (s.sbtcApy.min + s.sbtcApy.max) / 2;
    const usdcxMid = (s.usdcxApy.min + s.usdcxApy.max) / 2;
    return (sbtcMid * s.sbtcPct + usdcxMid * s.usdcxPct) / 100;
  }, []);

  const getLivePortfolioValue = useCallback((): number => {
    if (!position) return 0;
    const sbtcUsd = position.sbtcAllocation * btcPrice;
    const usdcxUsd = position.usdcxAllocation;
    return sbtcUsd + usdcxUsd + position.yieldEarned;
  }, [position, btcPrice]);

  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <SatFlowContext.Provider value={{
      connected, address, balance, isLoading, error,
      position, yieldHistory, btcPrice,
      connectWallet, disconnectWallet, fetchBalance,
      deposit, rebalance, withdraw, formatAddress,
      getBlendedApy, getLivePortfolioValue,
    }}>
      {children}
    </SatFlowContext.Provider>
  );
};

export default SatFlowContext;
