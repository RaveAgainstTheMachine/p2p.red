# Liquid Glass Styling Philosophy

The styling of **p2p.red** follows the **Liquid Glass** aesthetic—a modern evolution of glassmorphism that prioritizes depth, fluidity, and visual premiumness.

## 💎 Core Principles

1.  **Extreme Translucency**: Containers should feel like high-quality glass. Use `backdrop-blur` (minimum 16px) combined with subtle background opacities (5-15%).
2.  **Squircle Corners**: Avoid sharp or perfectly circular corners. Use large border radii (`rounded-2xl` or `rounded-3xl`) for a soft, premium feel.
3.  **Dynamic Gradients**: Every theme uses a dual-tone gradient system. These aren't static; they shift and pulse to give the interface life.
4.  **Micro-Glows**: Subtle shadows and border glows (`shadow-[0_0_15px_rgba(...)]`) emphasize the "liquid" nature of the glass.
5.  **Subtle Micro-animations**: Hover states should feel reactive—slight scaling, brightness shifts, and glow intensifications.

---

## 🎨 Theme Architecture (v1.5.0)

Starting with v1.5.0, p2p.red implements a **Multi-Variant Liquid Glass** system. The site intelligently randomizes its palette on every refresh unless a user specifies a preference.

### The 10 Color Variants

| Theme Name | Primary Hue | Accent Hue | Mood |
| :--- | :--- | :--- | :--- |
| **Indigo (Ocean)** | Indigo | Purple | Default, Professional |
| **Emerald (Forest)** | Emerald | Teal | Growth, Calm |
| **Rose (Sunset)** | Rose | Pink | Warmth, Passion |
| **Amber (Sahara)** | Amber | Orange | Energy, Sunlight |
| **Cyan (Atmosphere)** | Cyan | Sky | Light, Airy |
| **Slate (Monolith)** | Slate | Zinc | Technical, Industrial |
| **Crimson (Magma)** | Red | Rose | Intense, Alert |
| **Violet (Nebula)** | Violet | Fuchsia | Mystery, Space |
| **Lime (Electric)** | Lime | Yellow | High-Contrast, Playful |
| **Ebony (Void)** | Gray 900 | Slate 950 | Ultra-Dark, Sleek |

### Persistence & Randomization

1.  **Default State**: "Random". A new theme is selected on every site load.
2.  **User Preference**: Users can lock in a specific theme via the theme switcher.
3.  **Storage**: Preferences are stored in a cookie (`p2p_theme_preference`) to ensure consistency across sessions.
4.  **Brightness Control**: "Light" and "Dark" modes are independent of the color theme. They adjust the global brightness and translucency levels (e.g., higher blur and lower opacity in Dark mode).

---

## 🛠️ CSS Variables System

Themes are implemented via CSS variables injected at the root level:

```css
:root {
  --theme-primary: #...;
  --theme-primary-glow: rgba(..., 0.3);
  --theme-accent: #...;
  --theme-bg-start: #...;
  --theme-bg-end: #...;
}
```

This allows the entire UI (buttons, progress bars, highlights) to adapt instantly when a theme is switched.
