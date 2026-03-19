import React from 'react';
import { STRATEGIES, StrategyId, useSatFlow } from '../context/SatFlowContext';

interface StrategyCardProps {
  strategyId: StrategyId;
  selected: boolean;
  onSelect: (id: StrategyId) => void;
  compact?: boolean;
}

const RISK_COLORS: Record<number, string> = {
  1: 'var(--accent-green)',
  2: 'var(--accent-gold)',
  3: 'var(--accent-red)',
};

const RISK_LABELS: Record<number, string> = {
  1: 'Low Risk',
  2: 'Medium Risk',
  3: 'High Risk',
};

export const StrategyCard: React.FC<StrategyCardProps> = ({ strategyId, selected, onSelect, compact }) => {
  const strategy = STRATEGIES[strategyId];
  const { getBlendedApy } = useSatFlow();
  const blendedApy = getBlendedApy(strategyId);
  const riskColor = RISK_COLORS[strategy.riskLevel];

  return (
    <button
      onClick={() => onSelect(strategyId)}
      style={{
        background: selected ? 'var(--accent-gold-dim)' : 'var(--bg-card)',
        border: selected ? '1.5px solid var(--accent-gold)' : '1.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: compact ? '16px 20px' : '22px 24px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'var(--transition)',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: selected ? 'var(--shadow-glow-gold)' : 'none',
      }}
      onMouseEnter={e => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)';
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        }
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: '#000',
          fontWeight: 700,
        }}>✓</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: compact ? '15px' : '17px',
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>{strategy.label}</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: '20px',
            background: `${riskColor}18`,
            border: `1px solid ${riskColor}40`,
            fontSize: '11px',
            color: riskColor,
            fontWeight: 500,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: riskColor }} />
            {RISK_LABELS[strategy.riskLevel]}
          </div>
        </div>

        {/* APY badge */}
        <div style={{
          textAlign: 'right',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '22px',
            fontWeight: 500,
            color: selected ? 'var(--accent-gold)' : 'var(--text-primary)',
            lineHeight: 1,
          }}>{blendedApy.toFixed(1)}%</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Blended APY</div>
        </div>
      </div>

      {!compact && (
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: 16,
          lineHeight: 1.5,
        }}>{strategy.description}</div>
      )}

      {/* Allocation bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* sBTC bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              sBTC <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({strategy.sbtcApy.min}–{strategy.sbtcApy.max}% APY)</span>
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>{strategy.sbtcPct}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${strategy.sbtcPct}%`,
              background: 'linear-gradient(90deg, var(--accent-gold), #e8a020)',
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* USDCx bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              USDCx <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({strategy.usdcxApy.min}–{strategy.usdcxApy.max}% APY)</span>
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{strategy.usdcxPct}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${strategy.usdcxPct}%`,
              background: 'linear-gradient(90deg, var(--accent-blue), #2c7af5)',
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>
    </button>
  );
};
