import React, { useState } from 'react';
import { ArrowLeft, Send, CheckCircle2, Star, MessageSquare } from 'lucide-react';
import { Logo } from '../components/Logo';

interface FeedbackProps {
  onBack: () => void;
  apiBaseUrl: string;
}

export const Feedback: React.FC<FeedbackProps> = ({ onBack, apiBaseUrl }) => {
  const [content, setContent] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          rating,
          email: email || null,
          metadata: {
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) throw new Error('Failed to send feedback');
      
      setIsSuccess(true);
    } catch (err) {
      setError('Something went wrong, bud. Please try again later.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen app-shell relative overflow-hidden text-white flex flex-col items-center justify-center p-6">
        <div className="absolute inset-0 app-overlay-base" />
        <div className="absolute inset-0 app-overlay-accent animate-gradient-shift" />
        
        <div className="relative z-10 glass-card p-10 max-w-md w-full text-center animate-fade-up">
          <div className="mb-6 flex justify-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={40} className="text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-3">Feedback Received!</h2>
          <p className="text-white/60 mb-8 leading-relaxed">
            Thanks for the feedback, eh? The Security Moose is personally reviewing your comments as we speak.
          </p>
          <button
            onClick={onBack}
            className="btn-primary w-full"
          >
            Return to home base
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell relative overflow-hidden text-white">
      <div className="absolute inset-0 app-overlay-base" />
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift" />
      <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl animate-glow-pulse" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 mx-auto px-6 py-8 max-w-2xl min-h-screen flex flex-col">
        <header className="flex items-center justify-between mb-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="text-sm">Back</span>
          </button>
          <button onClick={onBack} className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
            <Logo size="small" />
          </button>
        </header>

        <div className="mb-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/60 mb-4">
            Feedback
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
            How are we doing, bud?
          </h1>
          <p className="mt-3 text-white/50 text-base leading-relaxed">
            p2p.red is built for you. Tell us what's working, what's broken, or what you'd like to see next.
          </p>
        </div>

        <div className="glass-card p-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-4">How much do you like p2p.red?</label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${
                      rating === star
                        ? 'bg-blue-500/20 border-blue-400 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-110'
                        : 'bg-white/5 border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                    }`}
                  >
                    <Star size={24} fill={rating === star ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <MessageSquare size={16} />
                Your thoughts
              </label>
              <textarea
                id="content"
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="The encryption is fast, but the moose looks a bit hungry..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-none"
              />
            </div>

            {/* Email (Optional) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                Email (if you want a reply, eh?)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="moose@p2p.red"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base group"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  Send to the moose
                </>
              )}
            </button>
          </form>
        </div>

        <footer className="mt-auto pt-10 text-xs text-white/30 flex items-center justify-center italic">
          No trackers, no data-selling, just raw feedback. 🇨🇦
        </footer>
      </div>
    </div>
  );
};
