import React from 'react';
import { Award } from 'lucide-react';

export const ResultBar = ({ option, totalVotes, isWinner, userVotedThis }) => {
  const count = option.vote_count || 0;
  const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

  return (
    <div style={{
      marginBottom: '1rem',
      position: 'relative',
    }}>
      {/* Option Label Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.45rem',
        fontSize: '0.95rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <span>{option.text}</span>
          {userVotedThis && (
            <span style={{
              fontSize: '0.7rem',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}>
              Your vote
            </span>
          )}
          {isWinner && totalVotes > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-emerald)', fontSize: '0.8rem' }}>
              <Award size={14} /> Leading
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {count} {count === 1 ? 'vote' : 'votes'}
          </span>
          <span style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '1rem',
            color: isWinner && totalVotes > 0 ? 'var(--accent-emerald)' : 'var(--text-primary)',
          }}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar Track & Animated Fill */}
      <div className="progress-bar-container">
        <div
          className={`progress-bar-fill ${isWinner && totalVotes > 0 ? 'winner' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
