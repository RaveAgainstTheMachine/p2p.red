import { useState } from 'react';
import { API_BASE_URL } from '../services/metadataApi';
import { Shield } from 'lucide-react';
import { Logo } from '../components/Logo';

export function Setup() {
  const [adminToken, setAdminToken] = useState('');
  const [siteTitle, setSiteTitle] = useState('P2P File Share');
  const [primaryColor, setPrimaryColor] = useState('indigo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Setup-Token': adminToken,
        },
        body: JSON.stringify({ siteTitle, primaryColor, features: {} }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 text-white font-inter">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-primary)]/10 to-purple-500/10 z-0"></div>
        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Initial Setup</h1>
            <p className="text-white/60 text-sm">Check your server console for the admin token.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Admin Token
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="password"
                  required
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors"
                  placeholder="Paste token from console"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Site Title
              </label>
              <input
                type="text"
                required
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Primary Color Theme
              </label>
              <select
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] transition-colors appearance-none"
              >
                <option value="indigo">Indigo</option>
                <option value="blue">Blue</option>
                <option value="green">Emerald</option>
                <option value="purple">Purple</option>
                <option value="rose">Rose</option>
                <option value="orange">Orange</option>
              </select>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-white/5 border border-white/10 p-4 transition-all hover:bg-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-primary)]/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative font-medium flex items-center justify-center gap-2 text-white">
                {loading ? 'Configuring...' : 'Complete Setup'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
