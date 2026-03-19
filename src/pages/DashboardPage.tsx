import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useSatFlow, STRATEGIES, StrategyId } from '../context/SatFlowContext';
import { StrategyCard } from '../components/StrategyCard';
import { WithdrawModal } from '../components/WithdrawModal';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const {
    position, btcPrice, getLivePortfolioValue,
    rebalance, connected,
  } = useSatFlow();

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRebalance, setShowRebalance] = useState(false);
  const [newStrategy, setNewStrategy] = useState<StrategyId>('balanced');
  const [rebalanceTxState, setRebalanceTxState] = useState<'idle' | 'pending' | 'success'>('idle');
  const [rebalanceError, setRebalanceError] = useState('');
  const [chartData, setChartData] = useState<Array<{ time: string; value: number; yield: number }>>([]);
  const [tick, setTick] = useState(0);

  // Animate tick for live numbers
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Build chart data from position
  useEffect(() => {
    if (!position) return;
    const now = Date.now();
    const elapsed = now - position.depositTimestamp;
    const points = 30;
    const data = Array.from({ length: points }, (_, i) => {
      const t = position.depositTimestamp + (elapsed * i / (points - 1));
      const elapsedSec = (t - position.depositTimestamp) / 1000;
      const strategy = STRATEGIES[position.strategyId];
      const sbtcApy = (strategy.sbtcApy.min + strategy.sbtcApy.max) / 2 / 100;
      const usdcxApy = (strategy.usdcxApy.min + strategy.usdcxApy.max) / 2 / 100;
      const sbtcUsd = position.sbtcAllocation * btcPrice;
      const usdcxUsd = position.usdcxAllocation;
      const yEarned = (sbtcUsd * sbtcApy + usdcxUsd * usdcxApy) * elapsedSec / (365 * 86400);
      const total = sbtcUsd + usdcxUsd + yEarned;
      return {
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: parseFloat(total.toFixed(2)),
        yield: parseFloat(yEarned.toFixed(6)),
      };
    });
    setChartData(data);
  }, [position, btcPrice, tick]);

  const handleRebalance = async () => {
    if (!position) return;
    if (newStrategy === position.strategyId) {
      setRebalanceError('You already have this strategy active.');
      return;
    }
    setRebalanceError('');
    setRebalanceTxState('pending');
    try {
      await rebalance(newStrategy);
      setRebalanceTxState('success');
      setTimeout(() => {
        setRebalanceTxState('idle');
        setShowRebalance(false);
      }, 2000);
    } catch (err: any) {
      setRebalanceError(err.message || 'Transaction cancelled.');
      setRebalanceTxState('idle');
    }
  };

  if (!connected) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: 16 }}>🔒</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', marginBottom: 8 }}>Wallet Required</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Connect your Hiro Wallet to view your dashboard.</div>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: 16 }}>₿</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', marginBottom: 8 }}>No Active Position</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Deploy your first BTC to start earning yield.</div>
          <button
            onClick={() => onNavigate('deposit')}
            style={{
              padding: '12px 28px',
              background: 'var(--accent-gold)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
          >Deploy Capital →</button>
        </div>
      </div>
    );
  }

  const liveValue = getLivePortfolioValue();
  const depositUsd = position.depositedBtc * position.btcPriceAtDeposit;
  const strategy = STRATEGIES[position.strategyId];
  const pnl = liveValue - depositUsd;
  const pnlPct = (pnl / depositUsd) * 100;
  const sbtcUsd = position.sbtcAllocation * btcPrice;
  const usdcxUsd = position.usdcxAllocation;

  const pieData = [
    { name: 'sBTC', value: sbtcUsd, color: '#f5a623' },
    { name: 'USDCx', value: usdcxUsd, color: '#4f8ef7' },
  ];

  const timeSince = () => {
    const s = (Date.now() - position.depositTimestamp) / 1000;
    if (s < 60) return `${Math.floor(s)}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '100px 24px 60px',
      maxWidth: '1100px',
      margin: '0 auto',
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: 6 }}>PORTFOLIO DASHBOARD</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.5px' }}>
            Your BTC Position
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setNewStrategy(position.strategyId); setShowRebalance(true); }}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'var(--transition)',
            }}
          >⇄ Rebalance</button>
          <button
            onClick={() => setShowWithdraw(true)}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-gold)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#000',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >Withdraw</button>
        </div>
      </div>

      {/* Top stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          label="Portfolio Value"
          value={`$${liveValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`+$${pnl.toFixed(4)}`}
          subColor="var(--accent-green)"
          accent
        />
        <StatCard
          label="Total Yield Earned"
          value={`$${position.yieldEarned.toFixed(4)}`}
          sub={`${pnlPct.toFixed(4)}% ROI`}
          subColor="var(--accent-green)"
          live
        />
        <StatCard
          label="Blended APY"
          value={`${position.currentApy.toFixed(2)}%`}
          sub={`${strategy.label} strategy`}
        />
        <StatCard
          label="Position Age"
          value={timeSince()}
          sub={`Since ${new Date(position.depositTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Chart */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
              Portfolio Performance
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--accent-green)',
              background: 'var(--accent-green-dim)',
              border: '1px solid rgba(62,207,142,0.2)',
              padding: '3px 10px',
              borderRadius: '20px',
            }}>● Live</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#55555f' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#55555f' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${v.toLocaleString('en', { maximumFractionDigits: 0 })}`}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(v: number) => [`$${v.toLocaleString('en', { minimumFractionDigits: 2 })}`, 'Portfolio Value']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f5a623"
                strokeWidth={2}
                fill="url(#valueGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation pie + breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pie */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', marginBottom: 16 }}>
              Allocation
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString('en', { minimumFractionDigits: 2 })}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: d.color }}>
                    ${d.value.toLocaleString('en', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Yield breakdown */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', marginBottom: 16 }}>
              Yield Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <YieldRow
                label="sBTC Yield"
                value={position.sbtcYield}
                apy={`${strategy.sbtcApy.min}–${strategy.sbtcApy.max}%`}
                color="var(--accent-gold)"
              />
              <YieldRow
                label="USDCx Yield"
                value={position.usdcxYield}
                apy={`${strategy.usdcxApy.min}–${strategy.usdcxApy.max}%`}
                color="var(--accent-blue)"
              />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Total Yield</span>
                  <span style={{
                    fontSize: '15px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-green)',
                    fontWeight: 500,
                  }}>+${position.yieldEarned.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active strategy */}
      <div style={{
        marginTop: 20,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>ACTIVE STRATEGY</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>{strategy.label}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>{strategy.description}</div>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--accent-gold)' }}>{strategy.sbtcPct}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>sBTC</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--accent-blue)' }}>{strategy.usdcxPct}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USDCx</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--accent-green)' }}>{position.currentApy.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Blended APY</div>
          </div>
        </div>
      </div>

      {/* Rebalance panel */}
      {showRebalance && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowRebalance(false); }}
        >
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', marginBottom: 6 }}>
              Rebalance Portfolio
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 24 }}>
              Select a new strategy. Your capital will be reallocated on-chain.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(Object.keys(STRATEGIES) as StrategyId[]).map(id => (
                <StrategyCard key={id} strategyId={id} selected={newStrategy === id} onSelect={setNewStrategy} compact />
              ))}
            </div>

            {rebalanceError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--accent-red-dim)',
                border: '1px solid rgba(240,82,82,0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--accent-red)',
                marginBottom: 16,
              }}>{rebalanceError}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowRebalance(false)} style={{
                flex: 1, padding: '12px', background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}>Cancel</button>
              <button
                onClick={handleRebalance}
                disabled={rebalanceTxState !== 'idle'}
                style={{
                  flex: 2, padding: '12px',
                  background: rebalanceTxState === 'success' ? 'var(--accent-green)' : 'var(--accent-gold)',
                  border: 'none', borderRadius: 'var(--radius-md)', color: '#000',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {rebalanceTxState === 'pending' && (
                  <div style={{
                    width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)',
                    borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                {rebalanceTxState === 'idle' && 'Confirm Rebalance'}
                {rebalanceTxState === 'pending' && 'Awaiting Wallet…'}
                {rebalanceTxState === 'success' && '✓ Rebalanced!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => onNavigate('deposit')}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  accent?: boolean;
  live?: boolean;
}> = ({ label, value, sub, subColor, accent, live }) => (
  <div style={{
    background: accent ? 'rgba(245,166,35,0.05)' : 'var(--bg-card)',
    border: `1px solid ${accent ? 'rgba(245,166,35,0.2)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.3px' }}>{label.toUpperCase()}</div>
      {live && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent-green)',
          boxShadow: '0 0 6px var(--accent-green)',
          marginTop: 3,
        }} />
      )}
    </div>
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '22px',
      fontWeight: 400,
      color: accent ? 'var(--accent-gold)' : 'var(--text-primary)',
      marginBottom: 4,
      animation: live ? 'countUp 0.3s ease' : 'none',
    }}>{value}</div>
    {sub && (
      <div style={{ fontSize: '12px', color: subColor || 'var(--text-muted)' }}>{sub}</div>
    )}
  </div>
);

const YieldRow: React.FC<{ label: string; value: number; apy: string; color: string }> = ({
  label, value, apy, color
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{apy} APY</div>
    </div>
    <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color }}>${value.toFixed(6)}</span>
  </div>
);
