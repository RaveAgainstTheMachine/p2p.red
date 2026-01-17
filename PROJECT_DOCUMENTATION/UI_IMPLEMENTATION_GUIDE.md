# UI Theme Implementation Guide

## 🎨 **Complete CSS for "Glassmorphism Ocean" Theme**

Copy this CSS to recreate our exact current UI:

```css
/* ===== BASE STYLES ===== */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Primary Blue Palette */
  --color-primary-50: #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-200: #bae6fd;
  --color-primary-300: #7dd3fc;
  --color-primary-400: #38bdf8;
  --color-primary-500: #0ea5e9;
  --color-primary-600: #0284c7;
  --color-primary-700: #0369a1;
  --color-primary-800: #075985;
  --color-primary-900: #0c4a6e;

  /* Accent Purple Palette */
  --color-accent-50: #faf5ff;
  --color-accent-100: #f3e8ff;
  --color-accent-200: #e9d5ff;
  --color-accent-300: #d8b4fe;
  --color-accent-400: #c084fc;
  --color-accent-500: #a855f7;
  --color-accent-600: #9333ea;
  --color-accent-700: #7e22ce;
  --color-accent-800: #6b21a8;
  --color-accent-900: #581c87;

  /* Glassmorphism Variables */
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* ===== GLOBAL STYLES ===== */
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  background: linear-gradient(135deg, #0c4a6e 0%, #1e1b4b 50%, #581c87 100%);
  background-size: 400% 400%;
  animation: gradient 15s ease infinite;
}

/* ===== ANIMATIONS ===== */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== COMPONENT CLASSES ===== */
@layer components {
  /* Glassmorphism Base */
  .glass {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
  }

  .glass-card {
    @apply glass rounded-2xl p-6;
  }

  /* Button Styles */
  .btn-primary {
    @apply px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300;
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500));
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(14, 165, 233, 0.5);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    @apply px-6 py-3 rounded-xl font-semibold text-white/90 transition-all duration-300;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Input Fields */
  .input-field {
    @apply w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-primary-400 transition-colors;
  }

  .share-code {
    @apply font-mono text-2xl tracking-widest text-center py-4 px-6 rounded-xl;
    background: rgba(0, 0, 0, 0.3);
    letter-spacing: 0.3em;
  }

  /* Drop Zone */
  .drop-zone {
    @apply glass-card border-2 border-dashed border-white/30 transition-all duration-300;
  }

  .drop-zone:hover,
  .drop-zone.active {
    border-color: var(--color-primary-400);
    background: rgba(14, 165, 233, 0.1);
  }

  /* Loading Spinner */
  .spinner {
    @apply w-16 h-16 border-4 border-primary-400 border-t-transparent rounded-full;
    animation: spin 1s linear infinite;
  }

  /* Feature Cards */
  .feature-card {
    @apply glass-card text-center hover:scale-105 transition-transform;
  }
}

/* ===== UTILITY CLASSES ===== */
@layer utilities {
  .text-gradient {
    background: linear-gradient(135deg, var(--color-primary-300), var(--color-accent-300));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .text-shadow {
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .hover-lift {
    transition: transform 0.3s ease;
  }

  .hover-lift:hover {
    transform: translateY(-2px);
  }
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 768px) {
  .glass-card {
    @apply p-4 rounded-xl;
  }
  
  .btn-primary,
  .btn-secondary {
    @apply px-4 py-2 text-sm;
  }
  
  .share-code {
    @apply text-xl py-3 px-4;
  }
}

/* ===== THEME VARIATIONS ===== */
.theme-sunset {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%);
}

.theme-forest {
  background: linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%);
}

.theme-midnight {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%);
}

.theme-cherry {
  background: linear-gradient(135deg, #881337 0%, #be123c 50%, #e11d48 100%);
}

.theme-mint {
  background: linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%);
}

.theme-gold {
  background: linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%);
}

.theme-rose {
  background: linear-gradient(135deg, #be123c 0%, #e11d48 50%, #f43f5e 100%);
}

.theme-slate {
  background: linear-gradient(135deg, #334155 0%, #475569 50%, #64748b 100%);
}

.theme-amber {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%);
}

.theme-emerald {
  background: linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%);
}
```

## 🎯 **React Component Templates**

### **Main App Structure**
```tsx
import { useState } from 'react';

function App() {
  const [appState, setAppState] = useState('idle');
  const [mode, setMode] = useState<'share' | 'receive'>('share');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {appState === 'idle' && (
          <div className="space-y-8">
            {/* Mode Toggle */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setMode('share')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  mode === 'share' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <Upload size={20} />
                Share Files
              </button>
              <button
                onClick={() => setMode('receive')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  mode === 'receive' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <Download size={20} />
                Receive Files
              </button>
            </div>

            {/* Content Area */}
            {mode === 'share' ? (
              <DropZone onFilesSelected={handleFilesSelected} />
            ) : (
              <ShareCodeInput onSubmit={handleCodeSubmit} />
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
              <FeatureCard
                icon={<Shield className="text-primary-400" size={32} />}
                title="End-to-End Encrypted"
                description="Your files are encrypted before leaving your device"
              />
              <FeatureCard
                icon={<Zap className="text-accent-400" size={32} />}
                title="Lightning Fast"
                description="Direct P2P transfers using WebRTC DataChannels"
              />
              <FeatureCard
                icon={<Lock className="text-green-400" size={32} />}
                title="Zero Knowledge"
                description="No files stored on servers, complete privacy"
              />
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="feature-card">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/60 text-sm">{description}</p>
    </div>
  );
}
```

### **Header Component**
```tsx
function Header() {
  return (
    <header className="glass-card sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-400 rounded-xl flex items-center justify-center">
              <Shield className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold text-white">P2P File Share</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="btn-secondary text-sm">
              Settings
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
```

### **Footer Component**
```tsx
function Footer() {
  return (
    <footer className="glass-card mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-white/60 text-sm">
            © 2026 P2P File Share. Privacy-first file sharing.
          </div>
          <div className="flex items-center gap-6 text-white/60 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

## 🎨 **Theme Switching Implementation**

```tsx
function ThemeToggle() {
  const [theme, setTheme] = useState('ocean');

  const themes = [
    { name: 'ocean', class: '' },
    { name: 'sunset', class: 'theme-sunset' },
    { name: 'forest', class: 'theme-forest' },
    { name: 'midnight', class: 'theme-midnight' },
    { name: 'cherry', class: 'theme-cherry' },
    { name: 'mint', class: 'theme-mint' },
    { name: 'gold', class: 'theme-gold' },
    { name: 'rose', class: 'theme-rose' },
    { name: 'slate', class: 'theme-slate' },
    { name: 'amber', class: 'theme-amber' },
    { name: 'emerald', class: 'theme-emerald' },
  ];

  return (
    <select 
      value={theme} 
      onChange={(e) => {
        const newTheme = e.target.value;
        setTheme(newTheme);
        document.body.className = themes.find(t => t.name === newTheme)?.class || '';
      }}
      className="input-field text-sm w-auto"
    >
      {themes.map(t => (
        <option key={t.name} value={t.name}>
          {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
        </option>
      ))}
    </select>
  );
}
```

## 📦 **Package Dependencies**

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.263.1"
  }
}
```

## 🎯 **Implementation Checklist**

- [ ] Copy CSS to `src/index.css`
- [ ] Install required packages
- [ ] Create React components
- [ ] Add theme toggle functionality
- [ ] Test responsive design
- [ ] Verify accessibility

This gives you the exact same beautiful glassmorphism UI with theme switching capability!
