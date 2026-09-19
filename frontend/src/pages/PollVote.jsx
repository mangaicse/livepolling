import React, { useState, useEffect, useCallback } from 'react';
import { api, getVoterFingerprint } from '../services/api';
import { useLivePoll } from '../hooks/useLivePoll';
import { useToast } from '../components/Toast';
import { ResultBar } from '../components/ResultBar';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Users, 
  BarChart2, 
  Vote, 
  Lock, 
  Radio, 
  Check, 
  ArrowLeft,
  Share2
} from 'lucide-react';

export const PollVote = ({ pollIdentifier, onBack }) => {
  const { addToast } = useToast();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [myVoteOptionIds, setMyVoteOptionIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Local storage check if this voter device already voted for this poll
  useEffect(() => {
    if (poll?.id) {
      const savedVotes = localStorage.getItem(`voted_poll_${poll.id}`);
      if (savedVotes) {
        try {
          const parsed = JSON.parse(savedVotes);
          setHasVoted(true);
          setMyVoteOptionIds(parsed);
          setShowResults(true);
        } catch {
          // ignore
        }
      }
    }
  }, [poll?.id]);

  // Initial Poll Fetch
  const fetchPoll = async () => {
    try {
      const data = await api.polls.get(pollIdentifier);
      setPoll(data.poll);
      if (data.poll.settings?.show_results_before_vote) {
        setShowResults(true);
      }
    } catch (err) {
      addToast(err.message || 'Poll not found', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoll();
  }, [pollIdentifier]);

  // WebSocket Live Real-Time Handler
  const handleWsUpdate = useCallback((update) => {
    if (!update) return;

    if (update.type === 'VOTE_UPDATE') {
      setPoll((prev) => {
        if (!prev) return prev;
        const updatedOptions = prev.options.map((opt) => ({
          ...opt,
          vote_count: update.counts[opt.id] !== undefined ? update.counts[opt.id] : opt.vote_count,
        }));
        return {
          ...prev,
          total_votes: update.total_votes,
          options: updatedOptions,
        };
      });
    } else if (update.type === 'STATUS_CHANGE') {
      setPoll((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            is_closed: update.is_closed,
          },
        };
      });
      if (update.is_closed) {
        addToast('Voting has been closed by the host', 'info');
      } else {
        addToast('Voting has been reopened by the host!', 'info');
      }
    }
  }, [addToast]);

  const { connected, viewerCount } = useLivePoll(poll?.id, handleWsUpdate);

  const toggleOption = (optId) => {
    if (hasVoted || poll?.settings?.is_closed) return;

    if (poll?.settings?.allow_multiple) {
      if (selectedOptions.includes(optId)) {
        setSelectedOptions(selectedOptions.filter((id) => id !== optId));
      } else {
        setSelectedOptions([...selectedOptions, optId]);
      }
    } else {
      setSelectedOptions([optId]);
    }
  };

  const handleVoteSubmit = async () => {
    if (selectedOptions.length === 0) {
      addToast('Please choose at least one option to vote', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.polls.vote(poll.id, selectedOptions);

      // Trigger Confetti effect
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#8b5cf6', '#10b981', '#38bdf8'],
      });

      setHasVoted(true);
      setMyVoteOptionIds(selectedOptions);
      setShowResults(true);
      localStorage.setItem(`voted_poll_${poll.id}`, JSON.stringify(selectedOptions));
      addToast('Vote registered successfully!', 'success');

      // Update local state immediately with returned counts
      if (res.counts) {
        setPoll((prev) => ({
          ...prev,
          total_votes: res.total_votes,
          options: prev.options.map((opt) => ({
            ...opt,
            vote_count: res.counts[opt.id] !== undefined ? res.counts[opt.id] : opt.vote_count,
          })),
        }));
      }
    } catch (err) {
      if (err.status === 409) {
        setHasVoted(true);
        setShowResults(true);
        addToast("You've already cast your vote on this device", 'info');
      } else {
        addToast(err.message || 'Failed to submit vote', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        Connecting to live poll...
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="glass-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '3rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Poll Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          The requested poll does not exist or the link might be expired.
        </p>
        <button onClick={onBack} className="btn btn-secondary">
          <ArrowLeft size={16} /> Return Home
        </button>
      </div>
    );
  }

  const isClosed = poll.settings?.is_closed;
  const maxVotes = Math.max(...poll.options.map((o) => o.vote_count || 0), 0);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Back Button */}
      <button
        onClick={onBack}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={16} /> All Polls
      </button>

      {/* Main Poll Card */}
      <div className="glass-card" style={{ padding: '2.25rem 2rem' }}>
        {/* Header Status Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className={isClosed ? 'badge badge-closed' : 'badge badge-live'}>
              <span className={isClosed ? 'dot-closed' : 'dot-live'} />
              {isClosed ? 'Closed' : 'Live'}
            </span>
            <span className="badge badge-code">{poll.code}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={15} color="var(--accent-primary)" />
              {viewerCount} watching
            </span>
            <span>•</span>
            <span>{poll.total_votes || 0} votes</span>
          </div>
        </div>

        {/* Question Title */}
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.65rem', lineHeight: 1.3 }}>
          {poll.title}
        </h2>

        {poll.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
            {poll.description}
          </p>
        )}

        {/* Closed Banner */}
        {isClosed && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: '#fda4af',
            fontSize: '0.9rem',
          }}>
            <Lock size={18} />
            <span>Voting has ended for this poll. You are viewing live final results.</span>
          </div>
        )}

        {/* Already Voted Banner */}
        {hasVoted && !isClosed && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: '#6ee7b7',
            fontSize: '0.9rem',
          }}>
            <CheckCircle2 size={18} />
            <span>Thank you for participating! Your vote has been tallied in real-time.</span>
          </div>
        )}

        {/* Voting Options or Results View */}
        {showResults || isClosed || hasVoted ? (
          /* Live Results View */
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} color="var(--accent-primary)" /> Live Breakdown
            </h4>

            {poll.options.map((option) => (
              <ResultBar
                key={option.id}
                option={option}
                totalVotes={poll.total_votes || 0}
                isWinner={maxVotes > 0 && option.vote_count === maxVotes}
                userVotedThis={myVoteOptionIds.includes(option.id)}
              />
            ))}

            {!hasVoted && !isClosed && (
              <button
                onClick={() => setShowResults(false)}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                <Vote size={18} /> Cast Your Vote
              </button>
            )}
          </div>
        ) : (
          /* Voting Form */
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {poll.settings?.allow_multiple ? 'Select all that apply:' : 'Select one option:'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
              {poll.options.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    style={{
                      padding: '1.1rem 1.25rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '1rem', fontWeight: 500 }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: poll.settings?.allow_multiple ? '4px' : '50%',
                        border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                      </div>
                      <span>{option.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleVoteSubmit}
              disabled={submitting || selectedOptions.length === 0}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', opacity: selectedOptions.length === 0 ? 0.5 : 1 }}
            >
              {submitting ? 'Submitting Vote...' : 'Submit My Vote'}
            </button>

            {poll.settings?.show_results_before_vote && (
              <button
                onClick={() => setShowResults(true)}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '0.85rem' }}
              >
                View Live Results First
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
