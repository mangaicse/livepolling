import React, { useState } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Plus, Trash2, CheckCircle2, ArrowRight, Eye, Settings2 } from 'lucide-react';

export const CreatePoll = ({ onNavigate, onPollCreated }) => {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([
    { text: 'Option A' },
    { text: 'Option B' },
    { text: 'Option C' },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length >= 10) {
      addToast('Maximum 10 options per poll', 'error');
      return;
    }
    setOptions([...options, { text: '' }]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      addToast('A poll must have at least 2 options', 'error');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index].text = value;
    setOptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      addToast('Please enter a poll title', 'error');
      return;
    }

    const cleanOptions = options.map((o) => ({ text: o.text.trim() })).filter((o) => o.text.length > 0);
    if (cleanOptions.length < 2) {
      addToast('Please provide at least 2 valid options', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const createdPoll = await api.polls.create({
        title: title.trim(),
        description: description.trim(),
        options: cleanOptions,
        allow_multiple: allowMultiple,
        show_results_before_vote: showResultsBeforeVote,
      });

      addToast('Poll created and ready for voting!', 'success');
      onPollCreated(createdPoll);
    } catch (err) {
      addToast(err.message || 'Failed to create poll', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>Create New Poll</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Configure your questions, add choices, and launch your real-time session
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Form Controls */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="input-group">
              <label className="input-label">Poll Question / Title *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Which programming language do you love most?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="input-group">
              <label className="input-label">Description or Instructions (optional)</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Add optional context for your audience..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Options List */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Options (2 to 10)</label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                >
                  <Plus size={14} /> Add Option
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder={`Choice ${idx + 1}`}
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={options.length <= 2}
                      onClick={() => handleRemoveOption(idx)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.65rem', opacity: options.length <= 2 ? 0.4 : 1 }}
                      title="Remove option"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: '1.25rem',
              marginBottom: '2rem',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
                <Settings2 size={16} color="var(--accent-primary)" />
                <span>Poll Settings</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                />
                <span>Allow participants to select multiple options</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={showResultsBeforeVote}
                  onChange={(e) => setShowResultsBeforeVote(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                />
                <span>Allow viewing live results before casting vote</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {submitting ? 'Creating Poll...' : 'Launch Live Poll'} <ArrowRight size={20} />
            </button>
          </form>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Eye size={16} />
            <span>Audience Live Preview</span>
          </div>

          <div className="glass-card-glow" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-live">
                <span className="dot-live" /> Live Preview
              </span>
              <span className="badge badge-code">PREVIEW</span>
            </div>

            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
              {title.trim() || 'Your Question Title Here'}
            </h3>

            {description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {description}
              </p>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {options.filter((o) => o.text.trim().length > 0).map((opt, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: allowMultiple ? '4px' : '50%',
                    border: '2px solid var(--text-muted)',
                  }} />
                  <span>{opt.text}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {allowMultiple ? 'Multiple selections allowed' : 'Single selection only'} • Realtime sync
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
