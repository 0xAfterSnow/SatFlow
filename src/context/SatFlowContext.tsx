import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { connect, disconnect, isConnected, getLocalStorage, openContractCall } from '@stacks/connect';
import { STACKS_TESTNET } from '@stacks/network';
import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  principalCV,
  stringAsciiCV,
  PostConditionMode,
} from '@stacks/transactions';

// ─── Network config ───────────────────────────────────────────────
const NETWORK = STACKS_TESTNET;
const API_BASE_URL = 'https://api.testnet.hiro.so';

// ─── Contract addresses ───────────────────────────────────────────
// Replace with your deployed contract addresses after deployment
const CONTRACT_ADDRESS = 'ST271YXGFQ29048X78A0WCVYRVG8KWHT0R976DXEE';
const VAULT_CONTRACT = 'satflow-vault';
const ROUTER_CONTRACT = 'satflow-router';
const STRATEGY_CONTRACT = 'satflow-strategy';

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
export const SatFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
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

  // ── Fetch balance on address change ──
  useEffect(() => {
    if (address) fetchBalance();
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
      // Silently fail; show 0
      setBalance(0);
    }
  }, [address]);

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
      localStorage.removeItem('satflow-position');
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
    const amountInMicroSTX = Math.floor(btcAmount * 1_000_000);

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: VAULT_CONTRACT,
        functionName: 'deposit',
        functionArgs: [
          uintCV(amountInMicroSTX),
          stringAsciiCV(strategyId),
        ],
        network: NETWORK,
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
        functionName: 'rebalance',
        functionArgs: [stringAsciiCV(newStrategyId)],
        network: NETWORK,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        onFinish: () => {
          const strategy = STRATEGIES[newStrategyId];
          const totalBtc = position.depositedSbtc;
          const totalUsd = totalBtc * btcPrice;
          setPosition(prev => prev ? {
            ...prev,
            strategyId: newStrategyId,
            sbtcAllocation: (strategy.sbtcPct / 100) * totalBtc,
            usdcxAllocation: (strategy.usdcxPct / 100) * totalUsd,
          } : null);
          resolve();
        },
        onCancel: () => reject(new Error('Transaction cancelled')),
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
      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: VAULT_CONTRACT,
        functionName: 'withdraw',
        functionArgs: [],
        network: NETWORK,
        postConditionMode: PostConditionMode.Allow,
        postConditions: [],
        onFinish: () => {
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
