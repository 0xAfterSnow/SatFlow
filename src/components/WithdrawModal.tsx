import React, { useState } from 'react';
import { useSatFlow } from '../context/SatFlowContext';

interface WithdrawModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ onClose, onSuccess }) => {
  const { position, withdraw, btcPrice, getLivePortfolioValue } = useSatFlow();
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
  const [result, setResult] = useState<{ deposit: number; yield: number; total: number } | null>(null);

  if (!position) return null;

  const depositUsd = position.depositedBtc * position.btcPriceAtDeposit;
  const liveValue = getLivePortfolioValue();
  const totalReturn = ((liveValue - depositUsd) / depositUsd) * 100;

  const handleWithdraw = async () => {
    setStep('processing');
    try {
      const res = await withdraw();
      setResult(res);
      setStep('success');
    } catch (err) {
      setStep('confirm');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease',
    }}
      onClick={e => { if (e.target === e.currentTarget && step !== 'processing') onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.25s ease',
      }}>
        {step === 'confirm' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '22px',
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}>Withdraw Position</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Your sBTC is returned — yield is credited to your wallet.
              </div>
            </div>

            {/* Summary */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <Row label="Initial Deposit" value={`$${depositUsd.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Row label="Yield Earned" value={`+$${position.yieldEarned.toFixed(4)}`} valueColor="var(--accent-green)" />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <Row
                  label="Total Return"
                  value={`$${liveValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  bold
                />
                <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--accent-green)', marginTop: 2 }}>
                  +{totalReturn.toFixed(3)}% ROI
                </div>
              </div>
            </div>

            {/* Simulated note */}
            <div style={{
              background: 'rgba(245,166,35,0.06)',
              border: '1px solid rgba(245,166,35,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: 24,
              lineHeight: 1.5,
            }}>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>Note:</span>{' '}
              The on-chain contract state is updated in real-time. Actual BTC transfer back uses bridging infrastructure outside this MVP scope.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'var(--transition)',
                }}
              >Cancel</button>
              <button
                onClick={handleWithdraw}
                style={{
                  flex: 2,
                  padding: '12px',
                  background: 'var(--accent-gold)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >Confirm Withdrawal</button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 48,
              height: 48,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent-gold)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', marginBottom: 8 }}>
              Processing Withdrawal
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Broadcasting transaction to Stacks network…
            </div>
          </div>
        )}

        {step === 'success' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--accent-green-dim)',
              border: '2px solid var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              margin: '0 auto 20px',
            }}>✓</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', marginBottom: 6 }}>
              Withdrawal Complete
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 24 }}>
              Your capital has been returned successfully.
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>Simulated BTC Returned</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: 'var(--accent-gold)', fontWeight: 500 }}>
                ${result.total.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--accent-green)', marginTop: 4 }}>
                +${result.yield.toFixed(4)} yield earned
              </div>
            </div>

            <button
              onClick={() => { onSuccess(); onClose(); }}
              style={{
                width: '100%',
                padding: '13px',
                background: 'var(--accent-gold)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >Return to App</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueColor?: string; bold?: boolean }> = ({
  label, value, valueColor, bold
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{
      fontSize: bold ? '16px' : '14px',
      fontFamily: 'var(--font-mono)',
      color: valueColor || 'var(--text-primary)',
      fontWeight: bold ? 600 : 400,
    }}>{value}</span>
  </div>
);
