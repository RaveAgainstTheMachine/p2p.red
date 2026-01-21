# SEO + Traffic Plan (No-Cost, Low-Effort, Quick Wins)

## Goals
- Improve discoverability for "p2p file share", "secure file sharing", and "webrtc file transfer".
- Drive incremental organic traffic with minimal ongoing maintenance.
- Avoid paid channels or heavy content production.

## Phase 1 (Same Day / <2 hours)

### 1) Technical SEO Basics
- Ensure `<title>` and meta description are unique and descriptive.
- Add canonical URL: `https://p2p.red/`.
- Verify Open Graph/Twitter tags are present (already in `index.html`).
- Add `robots.txt` and `sitemap.xml` (static, small).

### 2) Indexing + Search Console
- Add site to Google Search Console.
- Submit `sitemap.xml`.
- Verify indexing status and fix crawl errors.

### 3) Performance Wins (Quick)
- Ensure gzip/brotli enabled at proxy (already in Nginx).
- Keep main bundle size stable (avoid bloating).
- Check Lighthouse once to ensure no blocking errors.

## Phase 2 (1–2 days, low effort)

### 4) Minimal Content Expansion (High ROI)
Create a small static section on the homepage or a `/docs` route:
- **“How it works”** (3–5 bullets).
- **Security & privacy** (short, plain language).
- **FAQ** (5–8 questions).

### 5) Keyword Targeting (Lightweight)
Use natural wording in headings:
- “Secure peer‑to‑peer file sharing”
- “WebRTC file transfer”
- “End‑to‑end encrypted sharing”

## Phase 3 (Ongoing, no‑cost distribution)

### 6) Free Directory Listings
- GitHub “Awesome” lists for WebRTC / P2P.
- AlternativeTo (free listing).
- Product Hunt (free launch).
- Hacker News “Show HN” (launch post).

### 7) Community Posts (Low Effort)
- Reddit (r/selfhosted, r/privacy, r/webdev).
- Indie Hackers post with quick demo + screenshots.
- Dev.to or Medium short write‑up (reuse the FAQ content).

## Quick Checklist
- [ ] Add `robots.txt`
- [ ] Add `sitemap.xml`
- [ ] Add canonical tag in `index.html`
- [ ] Add small “How it works” section
- [ ] Add FAQ block
- [ ] Submit sitemap in Search Console
- [ ] Post to 2–3 directories

## Metrics to Track (Free)
- Search Console impressions + clicks.
- Top queries (keyword fit).
- Organic traffic (Plausible).

## Notes
- Keep copy accurate: no claims like “100% connection success.”
- Avoid mentioning HTTP/3 (project rules forbid QUIC).
- Focus on privacy and true P2P benefits.
