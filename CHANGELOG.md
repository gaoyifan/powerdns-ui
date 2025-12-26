# Changelog

## [1.1.3] - 2025-12-26

- **Feat**: Optimized record sorting algorithm to use **Natural Sort**, resolving the `1, 11, 2` legacy sorting issue. The order is now correctly `1, 2, 11`.

## [1.1.2] - 2025-12-26

- **Feat**: Improved record list sorting logic using **Reverse Domain Hierarchical Order**. Records with the same domain level are now grouped closer together (e.g., `www.example.com` is sorted as `com.example.www`).

## [1.1.1] - 2025-12-26

- **Feat**: Enhanced Zone File import functionality to support identifying and importing inline comments (starting with `;`) and displaying them in the preview interface.
- **Feat**: Improved confirmation dialog experience. The **Confirm** button now auto-focuses by default, allowing for quick confirmation using the Enter key.

## [1.1.0] - 2025-12-25

### Features & UI Improvements
- **UI**: Added `Esc` key support to quickly exit multi-selection mode or cancel inline editing.
- **UI**: Optimized table layout and inline edit component styles.
- **Fix**: Resolved dependency conflicts during bulk deletion by optimizing operation order (prioritizing CNAME and DELETE operations).

### Refactoring & Chore
- **Refactor**: Upgraded the notification system to use the `sonner` library for a modern Toast experience.
- **Refactor**: Reimplemented the `Modal` component using `@radix-ui/react-dialog` to significantly improve Accessibility.
- **Chore**: Refactored concurrency control logic using `p-limit`.
- **Chore**: Refactored time formatting logic using `date-fns`.
- **Chore**: Replaced custom clipboard logic with the `copy-to-clipboard` library for better compatibility.

## [1.0.5] - 2025-12-25

- **Chore**: Fixed production build issues.
- **Chore**: Updated `.gitignore` to ignore the reference directory.

## [1.0.4] - 2025-12-25

- **Feat**: Enhanced bulk action experience with a new "Clear Selection" button.
- **Feat**: Added "Click to Copy" functionality for record fields, showing copy buttons on hover.
- **Feat**: Added "Duplicate Record" functionality to create a new draft record based on an existing one.
- **Feat**: Added support for Shift-click multi-selection.
- **Style**: Standardized code formatting and styles.

## [1.0.3] - 2025-12-25

- **Feat**: Added support for **LUA** record types.
- **Fix**: Fixed Caddy default upstream address configuration.
- **Test**: Added test cases for LUA records.

## [1.0.2] - 2025-12-25

- **Feat**: Removed the "Skip redundant records" feature to simplify import logic.
- **Chore**: Cleaned up PowerDNS configuration templates.

## [1.0.1] - 2025-12-24

- **Feat**: Allowed deletion of SOA records.
- **Fix**: Fixed an issue causing duplicate SOA records when updating.
- **Fix**: Fixed CI environment variable configuration.
