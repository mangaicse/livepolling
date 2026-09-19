import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Zap, Radio, Users, ShieldCheck, ArrowRight, Sparkles, QrCode } from 'lucide-react';

export const Home = ({ onNavigate, onJoinPoll }) => {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [code, setCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      addToast('Please enter a 6-digit poll code', 'error');
      return;
    }
    onJoinPoll(cleanCode);
  };

  return (
    <div style={{ textAlign: 'center', paddingTop: '2.5rem' }}>
      {/* Top Banner Tag */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 1rem',
        borderRadius: '9999px',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        fontSize: '0.85rem',
        color: '#a5b4fc',
        marginBottom: '1.75rem',
      }}>
        <Sparkles size={16} />
        <span>Zero-Latency Polling Engine Powered by Go & Redis</span>
      </div>

      {/* Hero Heading */}
      <h1 style={{
        fontSize: 'clamp(2.5rem, 5vw, 4rem)',
        lineHeight: 1.15,
        marginBottom: '1.25rem',
        maxWidth: '850px',
        margin: '0 auto 1.25rem auto',
      }}>
        Engage Your Audience with{' '}
        <span style={{
          background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Live Real-Time
        </span>{' '}
        Polling
      </h1>

      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '1.2rem',
        maxWidth: '650px',
        margin: '0 auto 2.5rem auto',
      }}>
        Create instant interactive polls. Audience members vote on any device, and results stream live without refreshing.
      </p>

      {/* Join Box Card */}
      <div className="glass-card-glow" style={{
        maxWidth: '480px',
        margin: '0 auto 3.5rem auto',
        padding: '2rem',
      }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 600 }}>
          Join a Live Poll as Audience
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Enter the 6-character access code provided by your presenter
        </p>

        <form onSubmit={handleJoin} style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. 7KP92X"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{
              textAlign: 'center',
              letterSpacing: '0.25em',
              fontSize: '1.3rem',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            Join <ArrowRight size={18} />
          </button>
        </form>
      </div>

      {/* Call to Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '4.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => onNavigate(isAuthenticated ? 'create' : 'register')}
          className="btn btn-primary btn-lg"
        >
          <Radio size={20} />
          Create Your First Poll
        </button>

        {isAuthenticated ? (
          <button
            onClick={() => onNavigate('dashboard')}
            className="btn btn-secondary btn-lg"
          >
            Go to Dashboard
          </button>
        ) : (
          <button
            onClick={() => onNavigate('login')}
            className="btn btn-secondary btn-lg"
          >
            Sign In to Account
          </button>
        )}
      </div>

      {/* Features Showcase */}
      <div className="grid-3" style={{ textAlign: 'left', marginTop: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            color: 'var(--accent-primary)',
          }}>
            <Zap size={22} />
          </div>
          <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Zero-Refresh Live Feed</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Built on WebSockets and Redis Pub/Sub for sub-millisecond atomic broadcasting across hundreds of audience screens.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            color: 'var(--accent-emerald)',
          }}>
            <QrCode size={22} />
          </div>
          <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Instant QR Code Scan</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Presenters can project an instant high-res QR code. Audience members scan with mobile cameras to vote immediately.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            color: 'var(--accent-rose)',
          }}>
            <ShieldCheck size={22} />
          </div>
          <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Fraud & Duplicate Guard</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Atomic Redis set deduplication prevents ballot-box stuffing, ensuring one vote per participant device.
          </p>
        </div>
      </div>
    </div>
  );
};
