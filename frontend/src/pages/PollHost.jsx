import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useLivePoll } from '../hooks/useLivePoll';
import { useToast } from '../components/Toast';
import { ResultBar } from '../components/ResultBar';
import { QRCodeModal } from '../components/QRCodeModal';
import { 
  Users, 
  QrCode, 
  Play, 
  PauseCircle, 
  RotateCcw, 
  Copy, 
  Check, 
  Download, 
  ArrowLeft,
  Share2,
  Radio
} from 'lucide-react';

export const PollHost = ({ pollIdentifier, onBack }) => {
  const { addToast } = useToast();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initial Fetch
  const fetchPoll = async () => {
    try {
      const data = await api.polls.get(pollIdentifier);
      setPoll(data.poll);
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
    }
  }, []);

  const { connected, viewerCount } = useLivePoll(poll?.id, handleWsUpdate);

  const handleToggleStatus = async () => {
    if (!poll) return;
    const newStatus = !poll.settings?.is_closed;
    try {
      await api.polls.toggle(poll.id, newStatus);
      setPoll((prev) => ({
        ...prev,
        settings: { ...prev.settings, is_closed: newStatus },
      }));
      addToast(newStatus ? 'Voting closed' : 'Voting reopened live!', 'info');
    } catch (err) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleResetPoll = async () => {
    if (!poll) return;
    if (!window.confirm('Reset all votes for this poll to zero?')) return;

    try {
      await api.polls.reset(poll.id);
      setPoll((prev) => ({
        ...prev,
        total_votes: 0,
        options: prev.options.map((o) => ({ ...o, vote_count: 0 })),
      }));
      addToast('Votes reset successfully', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to reset poll', 'error');
    }
  };

  const copyShareLink = () => {
    if (!poll) return;
    const url = `${window.location.origin}/poll/${poll.code || poll.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    addToast('Audience voting link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!poll) return;
    let csvContent = 'data:text/csv;charset=utf-8,Option,Votes,Percentage\n';
    const total = poll.total_votes || 0;
    poll.options.forEach((opt) => {
      const pct = total > 0 ? ((opt.vote_count / total) * 100).toFixed(1) : '0.0';
      csvContent += `"${opt.text}",${opt.vote_count},${pct}%\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `poll_${poll.code}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        Loading presenter display...
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="glass-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '3rem' }}>
        <h3>Poll Not Found</h3>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </button>
      </div>
    );
  }

  const isClosed = poll.settings?.is_closed;
  const maxVotes = Math.max(...poll.options.map((o) => o.vote_count || 0), 0);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.75rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowQR(true)} className="btn btn-primary btn-sm">
            <QrCode size={16} /> Show QR Code
          </button>

          <button onClick={copyShareLink} className="btn btn-secondary btn-sm">
            {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
            {copied ? 'Link Copied' : 'Share Link'}
          </button>

          <button onClick={handleToggleStatus} className="btn btn-secondary btn-sm">
            {isClosed ? <Play size={16} color="var(--accent-emerald)" /> : <PauseCircle size={16} color="var(--accent-rose)" />}
            {isClosed ? 'Reopen Voting' : 'Close Voting'}
          </button>

          <button onClick={handleResetPoll} className="btn btn-secondary btn-sm" title="Reset all votes to 0">
            <RotateCcw size={16} /> Reset
          </button>

          <button onClick={exportCSV} className="btn btn-secondary btn-sm" title="Export results as CSV">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Main Projector Card */}
      <div className="glass-card-glow" style={{ padding: '2.5rem 2.5rem 3rem 2.5rem' }}>
        {/* Header Ribbon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.5rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <span className={isClosed ? 'badge badge-closed' : 'badge badge-live'}>
                <span className={isClosed ? 'dot-closed' : 'dot-live'} />
                {isClosed ? 'Voting Closed' : 'Live Polling'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Audience Code:
              </span>
              <span className="badge badge-code" style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}>
                {poll.code}
              </span>
            </div>
            <h1 style={{ fontSize: '2.25rem', lineHeight: 1.25 }}>{poll.title}</h1>
          </div>

          {/* Real-time Tickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>
                {poll.total_votes || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                Total Votes
              </div>
            </div>

            <div style={{ textAlign: 'center', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border-subtle)' }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: 'var(--accent-emerald)',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}>
                <span className="dot-live" style={{ width: '10px', height: '10px' }} />
                {viewerCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                Watching Now
              </div>
            </div>
          </div>
        </div>

        {/* Live Results Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {poll.options.map((option) => (
            <ResultBar
              key={option.id}
              option={option}
              totalVotes={poll.total_votes || 0}
              isWinner={maxVotes > 0 && option.vote_count === maxVotes}
            />
          ))}
        </div>

        {/* Presenter Footer Callout */}
        <div style={{
          marginTop: '3rem',
          padding: '1.25rem',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Radio size={16} color="var(--accent-emerald)" />
            <span>Streaming sub-millisecond votes via Redis Pub/Sub</span>
          </div>

          <div>
            Audience link: <strong style={{ color: '#fff' }}>{window.location.origin}/poll/{poll.code}</strong>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <QRCodeModal poll={poll} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
};
