import React from 'react';
import { useSatFlow } from '../context/SatFlowContext';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { connected, address, balance, connectWallet, disconnectWallet, formatAddress, isLoading } = useSatFlow();

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(10, 10, 11, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* Logo */}
      <button
        onClick={() => onNavigate('landing')}
        style={{
          background: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--accent-gold), #e8880a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 800,
          color: '#000',
          fontFamily: 'var(--font-display)',
        }}>₿</div>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '18px',
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}>SatFlow</span>
      </button>

      {/* Nav links */}
      {connected && (
        <div style={{ display: 'flex', gap: '4px' }}>
          {['dashboard', 'deposit'].map(page => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              style={{
                background: currentPage === page ? 'var(--accent-gold-dim)' : 'none',
                color: currentPage === page ? 'var(--accent-gold)' : 'var(--text-secondary)',
                border: currentPage === page ? '1px solid var(--accent-gold-mid)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'var(--transition)',
                fontFamily: 'var(--font-body)',
              }}
            >{page}</button>
          ))}
        </div>
      )}

      {/* Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {connected && balance !== null && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '4px 10px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}>
            {balance.toFixed(2)} STX
          </div>
        )}
        {connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}>
              <div style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 6px var(--accent-green)',
              }} />
              {formatAddress(address)}
            </div>
            <button
              onClick={disconnectWallet}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                padding: '6px 10px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.color = 'var(--accent-red)';
                (e.target as HTMLButtonElement).style.borderColor = 'var(--accent-red)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.target as HTMLButtonElement).style.borderColor = 'var(--border)';
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            style={{
              background: 'var(--accent-gold)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'var(--transition)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
};
