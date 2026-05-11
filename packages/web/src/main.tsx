import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

if (import.meta.env.PROD) {
  const emojiRegex = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  const sanitizeArg = (value: unknown) =>
    typeof value === 'string' ? value.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim() : value;
  const wrap = (fn: (...args: unknown[]) => void) => (...args: unknown[]) => fn(...args.map(sanitizeArg));
  const warn = console.warn.bind(console);
  const error = console.error.bind(console);

  console.log = () => undefined;
  console.info = () => undefined;
  console.debug = () => undefined;
  console.warn = wrap(warn);
  console.error = wrap(error);
}

// Inject Plausible if domain is provided
const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
if (plausibleDomain && import.meta.env.PROD) {
  const script = document.createElement('script');
  script.defer = true;
  script.setAttribute('data-domain', plausibleDomain);
  script.src = '/js/script.js';
  document.head.appendChild(script);
}

// Health check endpoint for load balancer
if (window.location.pathname === '/health') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div>healthy</div>
  )
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
