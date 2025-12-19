# Design Style Guide (enterprise light dashboard)

**Tone**

* Clean, data-dense, pragmatic.

**Color**

* Primary: Blue `#1677FF` (or similar).
* Neutrals: `#F7F8FA` bg, `#EFF1F4` card bg, `#D9DDE3` borders, `#111827` text.
* Status: Green ↑ success, Red ↓ danger, Amber warning, Grey info.
* Use color sparingly; rely on hierarchy and spacing.

**Typography**

* Sans-serif (e.g., Inter/Roboto).
* H1: 20–22px / semibold; H2: 16–18px / semibold.
* Body: 12–14px / regular.
* KPIs: 28–36px / bold; compact labels (11–12px, medium).

**Layout**

* Top app bar + left rail + content + right utility rail.
* 12-column grid; 24px outer gutter; 16px card padding.
* Information-first: metrics top, details below.

**Cards**

* Radius 6–8px; 1px neutral border; very light shadow.
* Title row, content, helper/footer.

**Navigation**

* Left rail: icons + labels; active state = blue bar + bold text.
* Keep nesting to two levels; collapse sections.

**Controls**

* Segmented control for time ranges.
* Compact dropdowns, pills for filters/status.
* Primary buttons: filled blue; secondary: ghost/outline.

**Iconography**

* Line icons in UI; category icons: isometric blue gradients.
* Consistent stroke and sizing (16/20/24px).

**Data Display**

* KPI tiles with deltas (▲/▼ + color).
* Tables dense, 48px row max, zebra optional.
* Charts minimal chrome; gridlines subtle; legends concise.

**Spacing**

* 8px base scale (4/8/16/24).
* Tight vertical rhythm; avoid empty expanses.

**States & Feedback**

* Hover: subtle bg shift/border.
* Focus: 2px outline (AA contrast).
* Loading: skeletons; Async: inline toasts top-right.

**Accessibility**

* Contrast ≥ 4.5:1 body, 3:1 large text.
* Color ≠ only signal; pair with icons/arrows.
* Hit targets ≥ 40×40px; keyboard navigable.

**Motion**

* Fast, subtle (120–180ms); fades/translate-y 2–4px.
* No blocking animations for data refresh.

**Content Style**

* Short labels, sentence case, unit suffixes on numbers.

**Color Chart**

| Category                   | Color      | Hex       | Usage                        |
| -------------------------- | ---------- | --------- | ---------------------------- |
| **Primary**                | Blue       | `#1677FF` | Buttons, links, highlights   |
| **Primary Hover**          | Blue Dark  | `#125FCC` | Hover/active primary         |
| **Success**                | Green      | `#52C41A` | Success, uptrend indicators  |
| **Error**                  | Red        | `#F5222D` | Errors, downtrend indicators |
| **Warning**                | Orange     | `#FAAD14` | Alerts, cautions             |
| **Info**                   | Cyan       | `#13C2C2` | Informational messages       |
| **Text Primary**           | Dark Gray  | `#111827` | Main text                    |
| **Text Secondary**         | Gray       | `#6B7280` | Labels, secondary info       |
| **Border**                 | Light Gray | `#D9DDE3` | Dividers, card outlines      |
| **Background**             | Off White  | `#F7F8FA` | Page background              |
| **Card Background**        | White      | `#FFFFFF` | Panels, cards                |
| **Disabled / Placeholder** | Gray Light | `#C9CDD4` | Inactive states              |

Notes:

* Use **blue** for all primary actions and active states.
* Pair **green/red arrows** with numeric deltas for performance trends.
* Maintain **ample contrast** (WCAG AA or higher).
