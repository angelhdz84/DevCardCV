# UX Audit: DevCardCV

## Screen Classification

| Screen | Type | Route | Primary Purpose |
|--------|------|-------|-----------------|
| Dashboard | Dashboard + List | `#/dashboard` | Overview stats, search, team table |
| Perfiles | List Page + Form (Modal) | `#/perfiles` | Browse developer cards, CRUD via modal |
| Habilidades | List Page + Settings | `#/habilidades` | Manage skill categories and individual skills |
| CV | Detail Page | `#/cv/:id` | View/export individual developer CV |

- **Architecture**: SPA with hash-based router, Alpine.js reactivity, IndexedDB (Dexie)
- **Design System**: Custom tokens on Tailwind CSS + DaisyUI, Bootstrap Icons
- **Theme**: "Developer Tool" — Slate canvas + Code Green accent (with Firecrawl overrides)

## Executive Summary

DevCardCV is a well-structured offline-first developer CV management app with a coherent design system, good use of design tokens, and thoughtful patterns (skip link, offline banner, FAB, toast system). The Lighthouse accessibility score of **90/100** is strong but has room for improvement. The main issues are **color contrast failures on accent colors**, **missing ARIA labels on icon-only buttons**, **inconsistent heading hierarchy**, and **no keyboard shortcuts for power users**. The visual design is clean and professional with good spacing and card patterns.

---

## Issues Found

### Critical (Severity 4 — Catastrophic)

| # | Issue | Location | Heuristic | Recommendation |
|---|-------|----------|-----------|----------------|
| C1 | **API keys exposed in source code** | `project.config.js` line 62-64 | H5 (Error Prevention) | Move EmailJS keys to environment variables or encrypted storage. The `publicKey`, `serviceId`, and `templateId` are visible in plain text. |
| C2 | **Accent color (#22c55e green) fails WCAG AA on canvas** | Global CSS `--accent` | WCAG 1.4.3 | Green `#22c55e` on `#f8fafc` = **2.18:1** ratio. Use darker green `#16a34a` (4.5:1+) for text, keep bright green for decorative elements only. |
| C3 | **White text on accent (#ff4d00) fails WCAG AA** | FAB button, "Compartir CV" card | WCAG 1.4.3 | White on `#ff4d00` = **3.33:1**. Change to dark text `#262626` on orange, or use darker orange `#cc3d00` for white text. |
| C4 | **White text on accent (#22c55e) fails WCAG AA** | FAB button hover state | WCAG 1.4.3 | White on `#22c55e` = **2.28:1**. Same fix as C3 — use dark text or darker background. |

### Major (Severity 3 — Significant Impact)

| # | Issue | Location | Heuristic | Recommendation |
|---|-------|----------|-----------|----------------|
| M1 | **Icon-only buttons lack accessible names** | Dashboard table actions (Ver CV, Editar), Perfiles card actions, Habilidades edit/delete | H4 (Consistency), WCAG 1.1.1 | Most icon-only buttons have `aria-label` (good), but some rely purely on Bootstrap Icons which screen readers read as unicode characters. Add `aria-label` to ALL icon-only buttons. |
| M2 | **Heading hierarchy inconsistent — H2 in sidebar duplicates page title** | Sidebar `h2` "DevCardCV" vs page `h1` "DevCardCV" | WCAG 1.3.1 | Change sidebar brand heading to `<p>` or `<span>` — it's not a section heading. Page titles should be the only H1/H2 per view. |
| M3 | **No loading state during page transitions** | Router `app.js` | H1 (Visibility) | `UI.showLoading()` is called but the spinner appears briefly then content renders. Add a skeleton loader or progress bar for smoother transitions, especially on slow devices. |
| M4 | **Modal form lacks focus trap** | Perfiles modal, Habilidades modals, `UI.confirm()` | WCAG 2.4.3 | The confirm dialog has Escape handling but no focus trap. The Perfiles modal uses `@keydown.escape` but doesn't trap Tab focus inside. Implement proper focus trapping. |
| M5 | **Destructive actions lack undo** | Perfiles "Eliminar", Habilidades "Eliminar categoría/skill" | H3 (User Control) | Delete operations are permanent with only a confirmation dialog. Add a brief undo toast (like Gmail's "Undo") for accidental deletions. |
| M6 | **Search has no debouncing** | Dashboard search input | H7 (Efficiency) | The `x-model="search"` triggers re-filtering on every keystroke. Add `.lazy` modifier or debounce for larger datasets. |
| M7 | **No pagination or virtual scrolling** | Dashboard table, Perfiles grid | H7 (Efficiency) | Will degrade with 50+ profiles. Implement pagination or virtual scroll for the table and card grid. |
| M8 | **Category deletion cascade is destructive with no backup** | Habilidades "Eliminar categoría" | H5 (Error Prevention) | Deleting a category removes ALL its skills AND all profile-skill relationships. Add explicit warning about data loss impact. |
| M9 | **CV page shows empty state when profile exists** | `#/cv/1` — shows "No hay perfiles creados aún." | H1 (Visibility) | The `x-if="!perfil"` condition triggers incorrectly. The `perfil` variable may be null due to JSON serialization issues with `cryptoHelpers.decrypt()` in the render template. Debug the data binding. |

### Minor (Severity 2 — Slight Confusion)

| # | Issue | Location | Heuristic | Recommendation |
|---|-------|----------|-----------|----------------|
| m1 | **`ink-faint` (#cbd5e1) fails contrast on canvas** | Checkbox borders, placeholder icons | WCAG 1.4.3 | Ratio: **1.42:1**. Use `#94a3b8` (slate-400) minimum for visible UI elements. |
| m2 | **Section labels are ALL CAPS via CSS** | `.section-label` class | H8 (Minimalist) | `text-transform: uppercase` on 0.6875rem text is hard to scan. Consider sentence case with font-weight distinction instead. |
| m3 | **FAB overlaps content on small screens** | FAB position `bottom: 1.5rem; right: 1.5rem` | H8 (Minimalist) | On mobile, the FAB covers the last row of cards/table. Add bottom padding to main content or reposition FAB on mobile. |
| m4 | **Toast notifications auto-dismiss after 3s** | `core/ui.js` toast() | H9 (Error Recovery) | Error toasts should persist longer or require dismissal. Users may miss error messages in 3 seconds. |
| m5 | **No keyboard shortcuts documented or implemented** | Entire app | H7 (Efficiency) | Add `Ctrl+N` for new profile, `Ctrl+S` for save, `Ctrl+F` for search, `Esc` to close modals. |
| m6 | **Import file inputs are hidden with no visible alternative** | Dashboard, Perfiles import buttons | H6 (Recognition) | `<input type="file" class="hidden">` relies on the label being clickable. Add `role="button"` to the label for screen readers. |
| m7 | **Charts have no accessible data tables** | Dashboard ApexCharts | WCAG 1.1.1 | Screen readers cannot interpret chart data. Add a hidden `<table>` with the same data for accessibility. |
| m8 | **Footer copyright text has very low contrast** | Footer `text-base-content/25` | WCAG 1.4.3 | `rgba(0,0,0,0.25)` on white = decorative-level contrast. Acceptable for copyright but consider `text-base-content/40`. |
| m9 | **No "skip to navigation" link** | Skip link only goes to `#app-content` | WCAG 2.4.1 | Add a second skip link to navigation for keyboard users who want to navigate between modules. |
| m10 | **Theme toggle checkbox is not labeled** | Topbar theme swap | WCAG 1.3.1 | The `<input type="checkbox">` for dark mode has no associated label. Screen readers announce it as "checkbox" without context. |
| m11 | **No route change announcement for screen readers** | Router navigation | WCAG 4.1.3 | When navigating between modules, screen readers don't announce the new page. Add `aria-live="polite"` region that updates with page title. |
| m12 | **Perfiles card "Eliminar" button color may not be clear enough** | Perfiles card actions | H5 (Error Prevention) | The delete button uses `text-error` class but is a ghost button. On hover it becomes clearer, but at rest it blends with other icon buttons. Add a subtle red background on hover. |

---

## Pattern Compliance

### Base Requirements (page-structure-patterns)

| Requirement | Status | Details |
|-------------|--------|---------|
| Loading state | **Pass** | `UI.showLoading()` with spinner + message used in router |
| Error state | **Pass** | Router catches errors and shows error empty state; toasts for operation errors |
| Empty state | **Pass** | `UI.emptyState()` with icon, message, and optional CTA action |
| Layout consistency | **Pass** | Consistent app shell with sidebar, topbar, main content, footer across all screens |
| Typography hierarchy | **Partial** | H1 in topbar, H2 for page titles, H3 for sections — but sidebar duplicates H2 |
| Spacing system | **Pass** | Uses 8pt grid via Tailwind spacing utilities consistently |

### Screen-Type Patterns

#### Dashboard
- [x] Stats cards with clear labels and values
- [x] Search/filter functionality
- [x] Data table with actions
- [x] Charts for data visualization
- [ ] Pagination for large datasets
- [ ] Export options clearly separated from primary content

#### Perfiles (List + Form)
- [x] Card grid layout with consistent card design
- [x] Empty state with CTA
- [x] Modal form with sections
- [x] Form validation (required fields disable submit)
- [ ] Inline field-level validation (only validates on submit)
- [ ] Form dirty state warning (no unsaved changes protection)

#### Habilidades (Settings-like)
- [x] Grouped by category
- [x] CRUD operations with confirmation
- [ ] Duplicate skill prevention (no check before adding)
- [ ] Drag-and-drop reordering of skills within categories

#### CV (Detail Page)
- [x] Profile selector dropdown
- [x] Export actions in sidebar
- [x] Info panel with metadata
- [ ] Print-optimized layout
- [ ] Shareable link generation

### Accessibility (WCAG 2.2 Level AA)

| Check | Status | Details |
|-------|--------|---------|
| Color contrast ≥4.5:1 normal text | **Fail** | Accent green (2.18:1), white on orange (3.33:1), white on green (2.28:1), ink-faint (1.42:1) |
| Color contrast ≥3:1 large text/UI | **Partial** | Accent-secondary passes (3.52:1), but accent fails |
| All images have alt text | **Pass** | Profile images use `:alt="dev.nombre"` |
| Form fields have labels | **Pass** | All inputs use `<label>` with visible text |
| Focus states visible | **Pass** | DaisyUI provides focus rings, custom inputs have orange focus shadow |
| Keyboard navigation | **Partial** | Tab order works, Escape closes modals, but no focus trap, no shortcuts |
| Skip link present | **Pass** | "Saltar al contenido" skip link implemented |
| Language declared | **Pass** | `<html lang="es">` |
| Reduced motion support | **Pass** | `@media (prefers-reduced-motion: reduce)` implemented |
| ARIA landmarks | **Pass** | `banner`, `main`, `contentinfo`, `complementary` present |
| Focus not obscured | **Partial** | FAB and sticky headers may obscure focused elements |
| Target size ≥24×24px | **Pass** | Buttons and inputs meet minimum size |

---

## Nielsen's 10 Heuristics Evaluation

| # | Heuristic | Rating | Notes |
|---|-----------|--------|-------|
| 1 | Visibility of system status | **7/10** | Toasts provide feedback, offline banner works. Missing: loading states for async operations, progress indicators for PDF export |
| 2 | Match between system and real world | **8/10** | Good terminology ("Desarrolladores", "Habilidades", "CV"). Icons are recognizable. |
| 3 | User control and freedom | **6/10** | Cancel buttons exist, Escape closes modals. Missing: undo for deletes, draft saving, back navigation within flows |
| 4 | Consistency and standards | **8/10** | Consistent card patterns, button styles, spacing. Minor: heading hierarchy inconsistency, mixed color system (design tokens vs Firecrawl overrides) |
| 5 | Error prevention | **5/10** | Confirm dialogs for deletes. Missing: duplicate detection, form validation before submit, destructive action warnings |
| 6 | Recognition rather than recall | **8/10** | Sidebar always visible, recent dates shown, skill counts visible. Good use of badges and visual cues. |
| 7 | Flexibility and efficiency | **4/10** | No keyboard shortcuts, no bulk operations, no search on Habilidades, no quick-edit inline |
| 8 | Aesthetic and minimalist design | **8/10** | Clean design, good whitespace, purposeful color use. Minor: ALL CAPS section labels, too many icon colors in charts |
| 9 | Error recovery | **6/10** | Error toasts with messages. Missing: specific recovery suggestions, inline field errors, error logging |
| 10 | Help and documentation | **3/10** | No help system, no tooltips, no onboarding, no keyboard shortcut reference |

---

## Color Contrast Analysis

| Color Combination | Ratio | WCAG AA (4.5:1) | WCAG AA Large (3:1) |
|-------------------|-------|-----------------|---------------------|
| ink (#0f172a) on canvas (#f8fafc) | 17.06:1 | PASS | PASS |
| ink-secondary (#334155) on canvas | 9.90:1 | PASS | PASS |
| ink-muted (#64748b) on canvas | 4.55:1 | PASS | PASS |
| **ink-faint (#cbd5e1) on canvas** | **1.42:1** | **FAIL** | **FAIL** |
| **accent (#22c55e) on canvas** | **2.18:1** | **FAIL** | **FAIL** |
| accent-secondary (#3b82f6) on canvas | 3.52:1 | FAIL | PASS |
| white on primary (#262626) | 15.13:1 | PASS | PASS |
| badge-skill-lenguajes on bg | 6.70:1 | PASS | PASS |
| section-label on canvas | 4.55:1 | PASS | PASS |
| alert-info text on bg | 6.82:1 | PASS | PASS |
| alert-warning text on bg | 4.92:1 | PASS | PASS |
| alert-error text on bg | 6.47:1 | PASS | PASS |
| **white on accent (#ff4d00)** | **3.33:1** | **FAIL** | PASS |
| **white on accent (#22c55e)** | **2.28:1** | **FAIL** | **FAIL** |

---

## Recommendations Summary (Prioritized)

### Phase 1 — Must Fix (Accessibility + Security)
1. **Fix color contrast failures** — Darken accent green to `#15803d` for text use, use dark text on orange/green buttons
2. **Remove exposed API keys** from `project.config.js` — move to encrypted storage or prompt user
3. **Add `aria-label` to all icon-only buttons** — especially in Habilidades where edit/delete buttons lack labels
4. **Fix heading hierarchy** — Change sidebar H2 to non-heading element
5. **Fix CV page rendering bug** — Debug why `#/cv/1` shows empty state despite profiles existing

### Phase 2 — Should Fix (Usability)
6. **Implement focus trap in modals** — Use a focus trap utility for all modal dialogs
7. **Add undo for destructive actions** — 5-second undo toast for delete operations
8. **Add field-level form validation** — Validate email format, required fields in real-time
9. **Extend error toast duration** — Error toasts should last 5-8s or be dismissible
10. **Label the theme toggle** — Add `aria-label="Cambiar tema oscuro/claro"` to the checkbox

### Phase 3 — Nice to Have (Power User Features)
11. **Add keyboard shortcuts** — `Ctrl+N` new profile, `Ctrl+F` focus search, `Esc` close modals
12. **Add search to Habilidades** — Filter skills by name
13. **Add pagination** — For dashboard table and perfiles grid
14. **Add accessible chart data** — Hidden tables behind ApexCharts
15. **Add help/onboarding** — Tooltip tour or help panel for first-time users

---

## Score

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Overall UX** | **7.2 / 10** | Strong foundation with good design system, but accessibility gaps and missing power-user features hold it back |
| Usability | 7.5/10 | Clear navigation, good empty states, consistent patterns. Lacks undo, shortcuts, inline validation |
| Accessibility | 6.5/10 | Good structure (skip link, landmarks, reduced motion) but critical contrast failures and missing ARIA labels |
| Visual Design | 8.5/10 | Clean, professional, well-spaced. Good card patterns, consistent tokens, thoughtful micro-interactions |
| Consistency | 8.0/10 | Strong internal consistency. Minor issues with heading hierarchy and color system overrides |

---

## Screenshots Captured

| File | Description |
|------|-------------|
| `docs/audit-dashboard.png` | Dashboard viewport screenshot |
| `docs/audit-dashboard-full.png` | Dashboard full-page screenshot |
| `docs/audit-perfiles.png` | Perfiles page screenshot |
| `docs/audit-habilidades.png` | Habilidades page screenshot |

---

*Audit performed: May 21, 2026*
*Tool: Chrome DevTools + Lighthouse (Accessibility: 90, Best Practices: 100, SEO: 80)*
*Methodology: Nielsen's 10 Heuristics + WCAG 2.2 Level AA + Visual Design System review*
