import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { 
  PlusCircle, 
  BarChart3, 
  Play, 
  PauseCircle, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Users, 
  CheckCircle2, 
  Radio
} from 'lucide-react';

export const Dashboard = ({ onNavigate, onSelectPoll }) => {
  const { addToast } = useToast();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchPolls = async () => {
    try {
      const data = await api.polls.getMyPolls();
      setPolls(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load polls', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleToggleStatus = async (pollId, currentStatus) => {
    try {
      await api.polls.toggle(pollId, !currentStatus);
      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId ? { ...p, settings: { ...p.settings, is_closed: !currentStatus } } : p
        )
      );
      addToast(!currentStatus ? 'Poll closed to voting' : 'Poll opened to voting', 'info');
    } catch (err) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDeletePoll = async (pollId) => {
    if (!window.confirm('Are you sure you want to permanently delete this poll?')) return;

    try {
      await api.polls.delete(pollId);
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
      addToast('Poll deleted successfully', 'info');
    } catch (err) {
      addToast(err.message || 'Failed to delete poll', 'error');
    }
  };

  const copyLink = (code) => {
    const url = `${window.location.origin}/poll/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    addToast('Direct link copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalVotesAcrossPolls = polls.reduce((acc, p) => acc + (p.total_votes || 0), 0);
  const activePollsCount = polls.filter((p) => !p.settings?.is_closed).length;

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Dashboard Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Creator Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage and monitor your live real-time polls
          </p>
        </div>

        <button
          onClick={() => onNavigate('create')}
          className="btn btn-primary"
        >
          <PlusCircle size={18} />
          Create New Poll
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{polls.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Polls Created</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-emerald)',
          }}>
            <Radio size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activePollsCount}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Live Polls</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-purple)',
          }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalVotesAcrossPolls}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Votes Captured</div>
          </div>
        </div>
      </div>

      {/* Polls List Section */}
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1.25rem' }}>Your Live Polls</h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading your polls...
        </div>
      ) : polls.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            color: 'var(--text-muted)',
          }}>
            <BarChart3 size={28} />
          </div>
          <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No polls created yet</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem', maxWidth: '400px', margin: '0 auto 1.75rem auto' }}>
            Design your first interactive poll and share the link with your audience in seconds.
          </p>
          <button onClick={() => onNavigate('create')} className="btn btn-primary">
            <PlusCircle size={18} /> Create a Poll
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {polls.map((poll) => {
            const isClosed = poll.settings?.is_closed;
            return (
              <div
                key={poll.id}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                }}
              >
                {/* Left Info */}
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                    <span className={isClosed ? 'badge badge-closed' : 'badge badge-live'}>
                      <span className={isClosed ? 'dot-closed' : 'dot-live'} />
                      {isClosed ? 'Closed' : 'Live'}
                    </span>
                    <span className="badge badge-code">{poll.code}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {poll.options?.length || 0} options
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    {poll.title}
                  </h4>

                  {poll.description && (
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      maxWidth: '550px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {poll.description}
                    </p>
                  )}
                </div>

                {/* Center Vote Stats */}
                <div style={{ textAlign: 'center', padding: '0 1rem' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {poll.total_votes || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Votes
                  </div>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => onSelectPoll(poll, 'host')}
                    className="btn btn-primary btn-sm"
                    title="Open Presenter Live View"
                  >
                    <BarChart3 size={16} />
                    Presenter Screen
                  </button>

                  <button
                    onClick={() => onSelectPoll(poll, 'vote')}
                    className="btn btn-secondary btn-sm"
                    title="Open Voter View"
                  >
                    <ExternalLink size={16} />
                    Vote Link
                  </button>

                  <button
                    onClick={() => copyLink(poll.code)}
                    className="btn btn-secondary btn-sm"
                    title="Copy direct share link"
                  >
                    {copiedCode === poll.code ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
                  </button>

                  <button
                    onClick={() => handleToggleStatus(poll.id, isClosed)}
                    className="btn btn-secondary btn-sm"
                    title={isClosed ? 'Reopen poll for voting' : 'Close poll to new votes'}
                  >
                    {isClosed ? <Play size={16} color="var(--accent-emerald)" /> : <PauseCircle size={16} color="var(--accent-rose)" />}
                  </button>

                  <button
                    onClick={() => handleDeletePoll(poll.id)}
                    className="btn btn-danger btn-sm"
                    title="Delete poll"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
