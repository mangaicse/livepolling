import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Radio, ArrowRight, Sparkles, User, GraduationCap, Mail } from 'lucide-react';

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

      {/* Developer Information Section */}
      <div style={{ maxWidth: '640px', margin: '2rem auto 0 auto', textAlign: 'left' }}>
        <div className="glass-card-glow" style={{ padding: '2rem 2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <span className="badge badge-code" style={{ fontSize: '0.75rem' }}>
              Project Creator
            </span>
            <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Developer Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                <User size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Developer Name
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mangai
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-emerald)',
              }}>
                <GraduationCap size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  College Name
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Annapoorana Engineering College
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}>
                <Mail size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email Address
                </div>
                <a
                  href="mailto:mangaicse@aecsalem.edu.in"
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  mangaicse@aecsalem.edu.in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
