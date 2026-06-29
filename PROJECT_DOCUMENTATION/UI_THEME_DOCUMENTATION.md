# UI Theme Documentation - Recreate Current Design

## 🎨 **Current UI Theme: "Glassmorphism Ocean"**

Our current UI is a beautiful glassmorphism design with animated gradients. Here's the complete specification for recreation:

## 📋 **Theme Specification**

### **Color Palette**
```css
/* Primary Blue */
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

/* Accent Purple */
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
```

### **Glassmorphism Effects**
```css
/* Glass Variables */
--glass-bg: rgba(255, 255, 255, 0.1);
--glass-border: rgba(255, 255, 255, 0.2);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

/* Glass Base Class */
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
```

### **Animated Background**
```css
body {
  background: linear-gradient(135deg, #0c4a6e 0%, #1e1b4b 50%, #581c87 100%);
  background-size: 400% 400%;
  animation: gradient 15s ease infinite;
}

@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

## 🎯 **Component Design System**

### **Button Styles**
```css
/* Primary Button */
.btn-primary {
  @apply px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300;
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-accent-500));
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.5);
}

/* Secondary Button */
.btn-secondary {
  @apply px-6 py-3 rounded-xl font-semibold text-white/90 transition-all duration-300;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

### **Input Fields**
```css
.input-field {
  @apply w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-primary-400 transition-colors;
}

.share-code {
  @apply font-mono text-2xl tracking-widest text-center py-4 px-6 rounded-xl;
  background: rgba(0, 0, 0, 0.3);
  letter-spacing: 0.3em;
}
```

### **Drop Zone**
```css
.drop-zone {
  @apply glass-card border-2 border-dashed border-white/30 transition-all duration-300;
}

.drop-zone:hover,
.drop-zone.active {
  border-color: var(--color-primary-400);
  background: rgba(14, 165, 233, 0.1);
}
```

## 🏗️ **Layout Structure**

### **Main App Layout**
```tsx
<div className="min-h-screen flex flex-col">
  <Header />
  
  <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
    {/* Content */}
  </main>
  
  <Footer />
</div>
```

### **Header Component**
- Glassmorphism navigation bar
- Logo and theme toggle
- Responsive design

### **Footer Component**
- Glassmorphism footer
- Links and information
- Consistent with header

## 🎭 **Interactive Elements**

### **Mode Toggle**
```tsx
<div className="flex justify-center gap-4 mb-8">
  <button className={mode === 'share' ? 'btn-primary' : 'btn-secondary'}>
    <Upload size={20} />
    Share Files
  </button>
  <button className={mode === 'receive' ? 'btn-primary' : 'btn-secondary'}>
    <Download size={20} />
    Receive Files
  </button>
</div>
```

### **Feature Cards**
```tsx
<div className="glass-card text-center hover:scale-105 transition-transform">
  <div className="mb-4">{icon}</div>
  <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
  <p className="text-white/60 text-sm">{description}</p>
</div>
```

### **Loading States**
```tsx
<div className="animate-spin w-16 h-16 mx-auto mb-4 border-4 border-primary-400 border-t-transparent rounded-full" />
```

## 🎨 **Typography & Text Effects**

### **Gradient Text**
```css
.text-gradient {
  background: linear-gradient(135deg, var(--color-primary-300), var(--color-accent-300));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### **Font Stack**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  sans-serif;
```

## 🌈 **Theme Variations**

### **Option 1: "Glassmorphism Ocean" (Current)**
- Blue/Purple gradient background
- Glass cards with blur effects
- Animated gradient background

### **Option 2: "Glassmorphism Sunset"**
```css
body {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%);
}
```

### **Option 3: "Glassmorphism Forest"**
```css
body {
  background: linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%);
}
```

### **Option 4: "Glassmorphism Midnight"**
```css
body {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%);
}
```

## 🔧 **Implementation Notes**

### **Dependencies Required**
```json
{
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.263.1",
  "react": "^18.2.0",
  "typescript": "^5.0.0"
}
```

### **Tailwind Configuration**
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          // ... primary colors from above
        },
        accent: {
          // ... accent colors from above
        }
      }
    }
  }
}
```

### **Accessibility Features**
- WCAG 2.1 AA compliant
- Semantic HTML5 structure
- ARIA labels where needed
- Keyboard navigation support
- Screen reader friendly

## 📱 **Responsive Design**

### **Breakpoints**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### **Mobile Adaptations**
- Stack elements vertically
- Reduce padding on small screens
- Touch-friendly button sizes
- Simplified navigation

## 🎯 **Key Design Principles**

1. **Glassmorphism**: Blur, transparency, depth
2. **Animated Gradients**: Smooth, engaging backgrounds
3. **Micro-interactions**: Hover effects, transitions
4. **Consistent Spacing**: 8px grid system
5. **Typography Hierarchy**: Clear visual structure
6. **Color Harmony**: Blue/purple complementary palette

## 📦 **Complete Theme Package**

To recreate exactly:
1. Use the CSS variables above
2. Implement the glassmorphism classes
3. Add the animated gradient background
4. Use the component structure provided
5. Include all micro-interactions and transitions

This creates a modern, professional, and visually stunning interface that users love.
