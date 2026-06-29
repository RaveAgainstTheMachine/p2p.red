import React, { useState } from 'react';
import { Send, CheckCircle2, Star, MessageSquare } from 'lucide-react';
import { siteName, siteDomain } from '../config/environments';

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
      <div className="glass-card p-10 max-w-md w-full text-center">
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
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/60 mb-4">
          Feedback
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
          How are we doing, bud?
        </h1>
        <p className="mt-3 text-white/50 text-base leading-relaxed">
          {siteName} is built for you. Tell us what's working, what's broken, or what you'd like to see next.
        </p>
      </div>

      <div className="glass-card p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-4">How much do you like {siteName}?</label>
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${
                    rating !== null && rating >= star
                      ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)] text-[var(--theme-primary)] shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-110'
                      : 'bg-white/5 border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
                  }`}
                >
                  <Star size={24} fill={rating !== null && rating >= star ? 'currentColor' : 'none'} />
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
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/40 transition-all resize-none"
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
              placeholder={`moose@${siteDomain}`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/40 transition-all"
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

      <p className="mt-8 text-center text-xs text-white/30 italic">
        No trackers, no data-selling, just raw feedback. 🇨🇦
      </p>
    </div>
  );
};
