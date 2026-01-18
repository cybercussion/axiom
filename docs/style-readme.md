# Axiom Design System

Zero-build. Fluid. Native.  
This document outlines the core styles available in `theme.css` and shared components.

## Typography

Axiom uses a fluid typography scale and native font stacks for maximum performance.

### Font Stacks
-   **Sans**: `var(--font-sans)` _(System UI)_
-   **Mono**: `var(--font-mono)` _(SF Mono, Cascadia, etc.)_

### Scale
Variables map to a modular scale (Perfect Fourth).
-   `--text-xs`: 0.75rem
-   `--text-sm`: 0.875rem
-   `--text-base`: 1rem
-   `--text-lg`: 1.125rem
-   `--text-xl`: 1.25rem
-   `--text-2xl`: 1.5rem
-   `--text-3xl`: 1.875rem
-   `--text-4xl`: 2.25rem

### Elements
-   **Headings**: `h1` through `h6` are reset. `h1` uses `--text-4xl`, `h2` uses `--text-3xl`, etc.
-   **Blockquotes**: Use `<blockquote class="motto">` for the "Sophisticated Minimalist" style (glassmorphism + primary accent).
-   **Code**: `pre` and `code` use glass backgrounds.

---

## Buttons

Buttons use a mix-and-match system of **Styles** and **Functional Colors**.

### 1. Base Class
Always start with `.btn`.

### 2. Styles (Shape & Texture)
-   `.btn-fill`: Solid gradient background, white text, shadow. (Primary actions)
-   `.btn-outline`: Glass backdrop, colored border with conic-gradient hover effect. (Secondary actions)
-   `.btn-ghost`: Transparent, subtle hover. (Tertiary/Nav actions)

### 3. Functional Variants (Color)
-   `.btn-primary`: Blue (Brand)
-   `.btn-secondary`: Grey / Neutral
-   `.btn-success`: Green
-   `.btn-warning`: Orange
-   `.btn-danger`: Red

### Example
```html
<!-- A Green Outline Button -->
<button class="btn btn-success btn-outline">Confirm</button>

<!-- A Red Filled Button -->
<button class="btn btn-danger btn-fill">Delete</button>
```

---

## Modals

The `<axiom-modal>` component wraps the native `<dialog>` element with extensive glassmorphism and animation styling.

### Usage
```html
<axiom-modal id="my-modal" title="System Alert" size="lg">
  <!-- Main Content -->
  <p>Modal body content goes here.</p>

  <!-- Footer Actions -->
  <div slot="actions">
    <button class="btn btn-secondary btn-ghost" onclick="close()">Cancel</button>
    <button class="btn btn-primary btn-fill" autofocus>Confirm</button>
  </div>
</axiom-modal>
```

### Attributes
-   **`title`**: Sets the header text.
-   **`size`**: Controls width.
    -   `sm`: 300px
    -   `md`: 500px (Default)
    -   `lg`: 800px
    -   `xl`: 1140px
    -   `xxl`: 95vw

### Best Practices
-   **Focus**: Add `autofocus` to the primary action button to improve keyboard UX.
-   **Responsiveness**: The footer actions automatically stack vertically on mobile.

---

## Layout & Spacing

### Fluid Spacing
Use these variables for padding/margins to ensure consistency across viewports.
-   `--space-2xs`
-   `--space-xs`
-   `--space-s`
-   `--space-m` (Base Layout Unit)
-   `--space-l`
-   `--space-xl`

### Utilities
-   **Glass Card**: Add `.glass-card` to any container for the signature blur/border/shadow look.
-   **Scroll Padding**: The system automatically adjusts `--nav-bottom-pad` and `--nav-left-pad` on `html`/`body` to prevent content from being hidden behind the Dock.
