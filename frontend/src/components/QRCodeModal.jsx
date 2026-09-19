import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

export const QRCodeModal = ({ poll, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!poll) return null;

  const pollUrl = `${window.location.origin}/poll/${poll.code || poll.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pollUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={22} />
        </button>

        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.4rem' }}>
          Scan to Vote
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Point your mobile phone camera at the QR code to vote live
        </p>

        {/* QR Code Container */}
        <div style={{
          background: '#ffffff',
          padding: '1.25rem',
          borderRadius: '16px',
          display: 'inline-block',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          marginBottom: '1.5rem',
        }}>
          <QRCodeSVG
            value={pollUrl}
            size={220}
            bgColor="#ffffff"
            fgColor="#0a0d14"
            level="Q"
            includeMargin={false}
          />
        </div>

        {/* 6-Digit Code Badge */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            Or join with 6-digit code:
          </span>
          <span className="badge badge-code" style={{ fontSize: '1.5rem', padding: '0.4rem 1.25rem', letterSpacing: '0.15em' }}>
            {poll.code}
          </span>
        </div>

        {/* Share Link Input with Copy Button */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.4rem 0.5rem 0.4rem 0.85rem',
        }}>
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left',
          }}>
            {pollUrl}
          </span>

          <button
            onClick={copyToClipboard}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 0.8rem', whiteSpace: 'nowrap' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};
