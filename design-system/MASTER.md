## Design System: SLPL Store

### Pattern
- **Name:** Video-First Hero
- **Conversion Focus:** 86% higher engagement with video. Add captions for accessibility. Compress video for performance.
- **CTA Placement:** Overlay on video (center/bottom) + Bottom section
- **Color Strategy:** Dark overlay 60% on video. Brand accent for CTA. White text on dark.
- **Sections:** 1. Hero with video background, 2. Key features overlay, 3. Benefits section, 4. CTA

### Style
- **Name:** Claymorphism
- **Mode Support:** Light ✓ Full | Dark ◐ Partial
- **Keywords:** Soft 3D, chunky, playful, toy-like, bubbly, thick borders (3-4px), double shadows, rounded (16-24px)
- **Best For:** Educational apps, children's apps, SaaS platforms, creative tools, fun-focused, onboarding, casual games
- **Performance:** ⚡ Good | **Accessibility:** ⚠ Ensure 4.5:1

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#4F46E5` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#818CF8` | `--color-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| Background | `#EEF2FF` | `--color-background` |
| Foreground | `#1E1B4B` | `--color-foreground` |
| Muted | `#EBEEF8` | `--color-muted` |
| Border | `#C7D2FE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#4F46E5` | `--color-ring` |

*Notes: Playful indigo + energetic orange [Accent adjusted from #F97316 for WCAG 3:1]*

### Typography
- **Heading:** Baloo 2
- **Body:** Comic Neue
- **Mood:** kids, education, playful, friendly, colorful, learning
- **Best For:** Children's apps, educational games, kid-friendly content
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&family=Comic+Neue:wght@300;400;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&family=Comic+Neue:wght@300;400;700&display=swap');
```

### Key Effects
Inner+outer shadows (subtle, no hard lines), soft press (200ms ease-out), fluffy elements, smooth transitions

### Avoid (Anti-patterns)
- Muted colors
- Low energy

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px


---

## SLPL Brand Overrides (authoritative - supersedes generated palette above)

The generated Claymorphism/indigo direction is kept only for *shape language*
(rounded 12-16px, soft shadows, playful cards). Colors and type follow the
actual company brochures:

| Role | Light | Dark |
|---|---|---|
| Primary (brand navy) | `#1E2A5A` | `#B9C6F2` (readable on navy-black) |
| CTA / highlight (saffron) | `#F5A623` (`--saffron`), deep `#D98A00` | same, deep `#FFBE4D` |
| Background | `#FFFFFF` | `#0B1222` |
| Foreground | `#16213E` | `#E8ECF7` |

- Headings: **Bricolage Grotesque** (`--font-heading`) - confident, warm grotesque matching brochure headline weight. Body: **Inter** (`--font-sans`).
- Light theme is default (shopping trust); dark available via header toggle.
- Saffron is exposed as Tailwind `saffron` / `saffron-deep` / `navy` color tokens.
- CTA buttons: saffron bg + navy text (contrast-safe), or primary navy + white.
