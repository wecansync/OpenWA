import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, KeyRound, Github } from 'lucide-react';
import './Login.css';
import './Setup.css';

interface SetupProps {
  onComplete: (apiKey: string) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name for your admin key.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.apiKey);
      } else if (res.status === 409) {
        setError('Setup is already complete. Please use your existing API key to log in.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Unable to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="login-container">
      <div className="login-card setup-card">
        <div className="login-logo">
          <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
        </div>

        {!createdKey ? (
          <>
            <div className="setup-badge">
              <KeyRound size={14} />
              First-Time Setup
            </div>
            <p className="setup-description">
              No API keys exist yet. Create your admin key to get started.
            </p>
            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group">
                <label htmlFor="keyName">Key name</label>
                <input
                  id="keyName"
                  type="text"
                  placeholder="e.g. My Admin Key"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={error ? 'error' : ''}
                  autoFocus
                />
                {error && <span className="error-message">{error}</span>}
              </div>
              <button type="submit" className="connect-btn" disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate Admin Key'}
              </button>
            </form>
          </>
        ) : (
          <div className="setup-created">
            <div className="setup-success-icon">
              <Check size={28} />
            </div>
            <h2 className="setup-created-title">Admin Key Created</h2>
            <p className="setup-created-hint">
              Copy this key now — it will never be shown again.
            </p>
            <div className="setup-key-box">
              <code className="setup-key-value">
                {showKey ? createdKey : createdKey.slice(0, 12) + '••••••••••••••••••••••••••••••••'}
              </code>
              <div className="setup-key-actions">
                <button className="icon-btn-sm" onClick={() => setShowKey(v => !v)} title="Toggle visibility">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button className="icon-btn-sm" onClick={copyKey} title="Copy key">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <button className="connect-btn" style={{ marginTop: '1.5rem' }} onClick={() => onComplete(createdKey)}>
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>

      <footer className="login-footer">
        <span>OpenWA</span>
        <a href="https://github.com/rmyndharis/OpenWA" target="_blank" rel="noopener noreferrer" className="github-link">
          <Github size={18} />
        </a>
      </footer>
    </div>
  );
}
