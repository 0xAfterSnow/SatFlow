import React from 'react';
import { useSatFlow } from '../context/SatFlowContext';
import { STRATEGIES } from '../context/SatFlowContext';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { connected, connectWallet, isLoading } = useSatFlow();

  const handleCTA = () => {
    if (connected) {
      onNavigate('deposit');
    } else {
      connectWallet();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px 60px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(ellipse, rgba(245,166,35,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Grid lines */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        opacity: 0.3,
        pointerEvents: 'none',
      }} />

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: '680px', position: 'relative', animation: 'fadeIn 0.6s ease' }}>
        {/* Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: 'var(--accent-gold-dim)',
          border: '1px solid var(--accent-gold-mid)',
          borderRadius: '20px',
          fontSize: '12px',
          color: 'var(--accent-gold)',
          fontWeight: 500,
          marginBottom: '32px',
          letterSpacing: '0.5px',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent-gold)',
            animation: 'pulse-gold 2s infinite',
          }} />
          BUILT ON STACKS · POWERED BY sBTC
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(40px, 6vw, 68px)',
          lineHeight: 1.05,
          color: 'var(--text-primary)',
          marginBottom: '24px',
          letterSpacing: '-1.5px',
        }}>
          Bitcoin is no
          <br />
          longer{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-gold), #e09020)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>idle capital.</span>
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: '40px',
          fontWeight: 300,
        }}>
          SatFlow routes your BTC into diversified yield strategies — blending{' '}
          <strong style={{ color: 'var(--accent-gold)', fontWeight: 500 }}>sBTC growth</strong> with{' '}
          <strong style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>USDCx stability.</strong>{' '}
          Programmable yield for BTC holders.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleCTA}
            disabled={isLoading}
            style={{
              padding: '14px 32px',
              background: 'var(--accent-gold)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.2px',
              transition: 'var(--transition)',
              boxShadow: '0 4px 24px rgba(245,166,35,0.3)',
            }}
          >
            {isLoading ? 'Connecting...' : connected ? 'Deploy Capital →' : 'Connect & Start'}
          </button>

          {connected && (
            <button
              onClick={() => onNavigate('dashboard')}
              style={{
                padding: '14px 28px',
                background: 'none',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'var(--transition)',
              }}
            >View Dashboard</button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        marginTop: '80px',
        display: 'flex',
        gap: '1px',
        background: 'var(--border)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        animation: 'fadeIn 0.8s ease 0.2s both',
      }}>
        {[
          { label: 'Max APY', value: '15%', sub: 'Aggressive sBTC' },
          { label: 'Stable Yield', value: '4–8%', sub: 'USDCx floor' },
          { label: 'Strategies', value: '3', sub: 'Allocation modes' },
          { label: 'Network', value: 'Stacks', sub: 'Bitcoin L2' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '20px 32px',
            background: 'var(--bg-card)',
            textAlign: 'center',
            minWidth: '140px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '22px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.3px' }}>{stat.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Strategy previews */}
      <div style={{
        marginTop: '80px',
        width: '100%',
        maxWidth: '860px',
        animation: 'fadeIn 1s ease 0.4s both',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: 8 }}>CAPITAL ALLOCATION</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px' }}>
            Choose your risk profile
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {Object.values(STRATEGIES).map(s => (
            <div key={s.id} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '16px',
                marginBottom: 12,
              }}>{s.label}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{
                  flex: s.sbtcPct,
                  height: 6,
                  background: 'linear-gradient(90deg, var(--accent-gold), #e8a020)',
                  borderRadius: '3px 0 0 3px',
                }} />
                <div style={{
                  flex: s.usdcxPct,
                  height: 6,
                  background: 'linear-gradient(90deg, var(--accent-blue), #2c7af5)',
                  borderRadius: '0 3px 3px 0',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>sBTC {s.sbtcPct}%</span>
                <span>USDCx {s.usdcxPct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
