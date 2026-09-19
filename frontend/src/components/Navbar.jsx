import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Radio, PlusCircle, LayoutDashboard, LogOut, LogIn, User } from 'lucide-react';

export const Navbar = ({ onNavigate, currentPage }) => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1.25rem 2rem',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand Logo */}
      <div 
        onClick={() => onNavigate('home')} 
        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-purple) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
        }}>
          <Radio size={20} color="#fff" />
        </div>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: '1.35rem',
          letterSpacing: '-0.03em',
          background: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          LivePoll
        </span>
        <span className="badge badge-live" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
          Realtime
        </span>
      </div>

      {/* Nav Links & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <button
          onClick={() => onNavigate('home')}
          className="btn btn-secondary btn-sm"
          style={{
            background: currentPage === 'home' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            borderColor: currentPage === 'home' ? 'var(--border-highlight)' : 'transparent',
          }}
        >
          Explore
        </button>

        {isAuthenticated ? (
          <>
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn btn-secondary btn-sm"
              style={{
                background: currentPage === 'dashboard' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                borderColor: currentPage === 'dashboard' ? 'var(--border-highlight)' : 'transparent',
              }}
            >
              <LayoutDashboard size={16} />
              My Polls
            </button>

            <button
              onClick={() => onNavigate('create')}
              className="btn btn-primary btn-sm"
            >
              <PlusCircle size={16} />
              Create Poll
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              paddingLeft: '0.5rem',
              borderLeft: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}>
                <User size={15} color="var(--accent-primary)" />
                <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name}
                </span>
              </div>

              <button
                onClick={logout}
                className="btn btn-secondary btn-sm"
                title="Logout"
                style={{ padding: '0.45rem', borderRadius: '50%' }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => onNavigate('login')}
              className="btn btn-secondary btn-sm"
            >
              <LogIn size={15} />
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="btn btn-primary btn-sm"
            >
              Host a Poll
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
