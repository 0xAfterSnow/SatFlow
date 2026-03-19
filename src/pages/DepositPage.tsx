import React, { useState } from 'react';
import { useSatFlow, STRATEGIES, StrategyId } from '../context/SatFlowContext';
import { StrategyCard } from '../components/StrategyCard';

interface DepositPageProps {
  onNavigate: (page: string) => void;
}

export const DepositPage: React.FC<DepositPageProps> = ({ onNavigate }) => {
  const { deposit, btcPrice, isLoading, position, getBlendedApy } = useSatFlow();
  const [amount, setAmount] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('balanced');
  const [error, setError] = useState('');
  const [txState, setTxState] = useState<'idle' | 'pending' | 'success'>('idle');

  const btcAmount = parseFloat(amount) || 0;
  const usdValue = btcAmount * btcPrice;
  const strategy = STRATEGIES[selectedStrategy];
  const blendedApy = getBlendedApy(selectedStrategy);
  const estYearlyUsd = usdValue * (blendedApy / 100);

  const handleDeploy = async () => {
    setError('');
    if (!btcAmount || btcAmount <= 0) {
      setError('Enter a valid BTC amount.');
      return;
    }
    if (btcAmount < 0.001) {
      setError('Minimum deposit is 0.001 BTC.');
      return;
    }
    if (position) {
      setError('You already have an active position. Withdraw first or rebalance from the dashboard.');
      return;
    }

    try {
      setTxState('pending');
      await deposit(btcAmount, selectedStrategy);
      setTxState('success');
      setTimeout(() => onNavigate('dashboard'), 1500);
    } catch (err: any) {
      setError(err.message || 'Transaction failed or was cancelled.');
      setTxState('idle');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '100px 24px 60px',
      maxWidth: '840px',
      margin: '0 auto',
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '8px' }}>
          STEP 1 OF 1 — DEPLOY CAPITAL
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '32px',
          letterSpacing: '-0.5px',
          marginBottom: '8px',
        }}>Deposit & Allocate</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Enter your BTC amount and choose a yield strategy. Your capital is routed on-chain via Stacks.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        {/* Left: Input + Strategies */}
        <div>
          {/* Amount input */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              fontWeight: 500,
            }}>DEPOSIT AMOUNT</div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--bg-secondary)',
              border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '4px 4px 4px 16px',
              transition: 'var(--transition)',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-gold)', fontSize: '20px' }}>₿</span>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                placeholder="0.00000000"
                min="0.001"
                step="0.001"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '22px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 400,
                  width: '100%',
                }}
              />
              <span style={{
                padding: '10px 16px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}>BTC</span>
            </div>

            {btcAmount > 0 && (
              <div style={{
                marginTop: 10,
                fontSize: '13px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                ≈ ${usdValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>@ ${btcPrice.toLocaleString()}/BTC</span>
              </div>
            )}

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              {[0.01, 0.05, 0.1, 0.5].map(v => (
                <button
                  key={v}
                  onClick={() => { setAmount(String(v)); setError(''); }}
                  style={{
                    padding: '5px 12px',
                    background: parseFloat(amount) === v ? 'var(--accent-gold-dim)' : 'var(--bg-secondary)',
                    border: parseFloat(amount) === v ? '1px solid var(--accent-gold-mid)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: parseFloat(amount) === v ? 'var(--accent-gold)' : 'var(--text-muted)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >{v} BTC</button>
              ))}
            </div>

            {error && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--accent-red-dim)',
                border: '1px solid rgba(240,82,82,0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--accent-red)',
              }}>{error}</div>
            )}
          </div>

          {/* Strategy selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: 500 }}>
              SELECT YIELD STRATEGY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(Object.keys(STRATEGIES) as StrategyId[]).map(id => (
                <StrategyCard
                  key={id}
                  strategyId={id}
                  selected={selectedStrategy === id}
                  onSelect={setSelectedStrategy}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary card */}
        <div style={{ position: 'sticky', top: '84px' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '16px',
              marginBottom: '20px',
            }}>Deployment Summary</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SummaryRow
                label="Deposit"
                value={btcAmount > 0 ? `${btcAmount} BTC` : '—'}
                sub={btcAmount > 0 ? `$${usdValue.toLocaleString('en', { maximumFractionDigits: 0 })}` : undefined}
              />
              <SummaryRow label="Strategy" value={strategy.label} />
              <SummaryRow
                label="sBTC Allocation"
                value={btcAmount > 0 ? `${(btcAmount * strategy.sbtcPct / 100).toFixed(6)} BTC` : '—'}
                sub={`${strategy.sbtcPct}% → Growth`}
                color="var(--accent-gold)"
              />
              <SummaryRow
                label="USDCx Allocation"
                value={btcAmount > 0 ? `$${(usdValue * strategy.usdcxPct / 100).toLocaleString('en', { maximumFractionDigits: 0 })}` : '—'}
                sub={`${strategy.usdcxPct}% → Stability`}
                color="var(--accent-blue)"
              />

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <SummaryRow
                  label="Blended APY"
                  value={`${blendedApy.toFixed(1)}%`}
                  color="var(--accent-green)"
                />
                {btcAmount > 0 && (
                  <SummaryRow
                    label="Est. Annual Yield"
                    value={`$${estYearlyUsd.toFixed(2)}`}
                    sub="Simulated projection"
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={txState === 'pending' || txState === 'success' || !btcAmount}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '14px',
                background: txState === 'success' ? 'var(--accent-green)' : 'var(--accent-gold)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#000',
                fontSize: '15px',
                fontWeight: 700,
                cursor: !btcAmount || txState !== 'idle' ? 'not-allowed' : 'pointer',
                opacity: !btcAmount ? 0.5 : 1,
                fontFamily: 'var(--font-display)',
                transition: 'var(--transition)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {txState === 'pending' && (
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(0,0,0,0.3)',
                  borderTopColor: '#000',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              )}
              {txState === 'idle' && 'Deploy Capital →'}
              {txState === 'pending' && 'Awaiting Wallet…'}
              {txState === 'success' && '✓ Deployed! Redirecting…'}
            </button>

            <div style={{ marginTop: 12, fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Transaction signed with Hiro Wallet on Stacks testnet. Contracts: vault.clar + router.clar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label, value, sub, color
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
    <div style={{ textAlign: 'right' }}>
      <div style={{
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
        color: color || 'var(--text-primary)',
        fontWeight: 500,
      }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);
