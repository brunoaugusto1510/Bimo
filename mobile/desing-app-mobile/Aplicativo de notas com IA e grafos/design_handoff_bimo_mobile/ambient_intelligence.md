---
name: Ambient Intelligence
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#3e4a40'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#6e7a6f'
  outline-variant: '#bdcabd'
  surface-tint: '#5e4bc0'
  primary: '#5e4bc0'
  on-primary: '#ffffff'
  primary-container: '#9988ff'
  on-primary-container: '#2f1191'
  inverse-primary: '#c9bfff'
  secondary: '#4bb6c0'
  on-secondary: '#ffffff'
  secondary-container: '#88f5ff'
  on-secondary-container: '#118691'
  tertiary: '#5e5d69'
  on-tertiary: '#ffffff'
  tertiary-container: '#bab8c6'
  on-tertiary-container: '#494955'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5deff'
  primary-fixed-dim: '#c9bfff'
  on-primary-fixed: '#1a0063'
  on-primary-fixed-variant: '#4631a7'
  secondary-fixed: '#defcff'
  secondary-fixed-dim: '#bffaff'
  on-secondary-fixed: '#005b63'
  on-secondary-fixed-variant: '#319da7'
  tertiary-fixed: '#e3e1ef'
  tertiary-fixed-dim: '#c7c5d3'
  on-tertiary-fixed: '#1b1b25'
  on-tertiary-fixed-variant: '#464651'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  display-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-base:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: '0'
  body-medium:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  gutter: 16px
  sidebar-width: 288px
  chat-max-width: 672px
---

## Brand & Style

This design system is engineered for focused, intellectual knowledge work. It sits at the intersection of **Minimalism** and **Modern Corporate** aesthetics, drawing heavy inspiration from high-density developer tools and personal knowledge management systems. The brand personality is calm, cerebral, and highly responsive—represented visually by "breathing" kinetic elements and structural transparency.

The UI should evoke a sense of a "Second Brain": an organized, infinite space where thoughts are interconnected. Key visual characteristics include:
- **Hairline Precision:** Use of 1px borders to define structure without adding visual bulk.
- **Kinetic Transparency:** Layering functional conversational elements over an active, breathing knowledge graph.
- **Asymmetric Fluidity:** Using varied corner radii to distinguish between participants in a conversation.
- **Restrained Density:** High information density balanced by generous neutral canvases to prevent cognitive overload.

## Colors

The palette is anchored by high-contrast neutrals and two distinct functional accents. It supports a full range of semantic states while maintaining a clean, obsidian-like clarity.

- **Primary (Electric Iris):** Reserved for action, growth, and connectivity. Used for primary CTAs, active graph nodes, interactive hyperlinks, user-generated content, and speech bubbles.
- **Secondary (Teal Current):** A calm complementary accent used for secondary actions, supporting badges, and complementary highlights across the knowledge graph.
- **Tertiary (Lavender Tint):** A low-saturation supporting tint used for subtle highlights, such as active navigation states or background badges.
- **Neutral Hierarchy:** 
    - **Surface:** Pure white for panels and elevated containers.
    - **Canvas:** A soft off-white (`#f7f7f8`) for the global background to reduce eye strain.
    - **Border:** A cool gray (`#e3e3e6`) for hairline dividers.

## Typography

This system uses a highly technical typographic scale optimized for Markdown readability and data density. **Geist** provides the necessary geometric clarity for both UI labels and long-form reading.

**Usage Rules:**
- **Markdown Rhythm:** Paragraphs within messages must maintain strict vertical spacing (`margin-y: 8px`). Lists should use a 20px left indent with custom bullet styling.
- **Code Integration:** Inline code should be treated as a "pill" with a subtle background and a slightly reduced font size (`0.85em`) to prevent line-height disruption.
- **Links:** All links should be Primary Iris with a persistent underline to ensure accessibility and clarity within dense text blocks.

## Layout & Spacing

The layout utilizes a **Fixed-Fluid Hybrid** model. The interface is divided into functional zones that manage their own internal scrolling, preventing the "global" page from ever scrolling.

- **Sidebar (Fixed):** A 288px vertical pane for navigation and vault hierarchy. It uses a recursive tree structure with 12px incremental indentation per level.
- **Conversational Arena (Fluid):** A centered lane with a maximum width of 672px to maintain optimal line lengths for reading (approx. 70-80 characters).
- **Glass Dock:** A pinned bottom input area that uses `backdrop-blur` and 90% opacity to allow the background knowledge graph to remain visible as it "drifts" behind the UI.
- **Breakpoints:** At `768px`, the sidebar transitions from a persistent side pane to a full-screen mobile overlay triggered by a hamburger menu.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Base Layer:** The Knowledge Graph Canvas (lowest elevation).
- **Secondary Layer:** The Chat Stream (semi-transparent, floating above the canvas).
- **Surface Layer:** White panels (Sidebar, Cards, Agent Bubbles) which use a 1px `--borda` outline for separation.
- **Floating Layer:** Modal Dialogs and the Input Dock. These use `shadow-xl` (a highly diffused, low-opacity ambient shadow) and `backdrop-blur-sm` (4px) to create a "frosted glass" effect, signaling they are above the active graph.

## Shapes

The design system uses a hierarchical rounding system to communicate the nature of the container:

- **Micro-elements (8px):** Utility buttons, folder tree items, and code badges.
- **Standard Containers (12px):** Suggestion cards, input fields, and modal dialogs.
- **Conversational Bubbles (16px):** Speech bubbles use a 16px base radius. To indicate directionality, the corner "tail" (bottom-right for user, bottom-left for agent) is tapered to 6px.

## Components

### Buttons
- **Primary:** Rounded-xl, background Primary Iris, text White. Semi-bold.
- **Secondary/Suggestion:** Full-width pills, White background, 1px Border, Muted text. Hover state shifts border to Primary Iris.
- **Utility:** Rounded-lg, 1px Border, extra-small typography for meta-actions like "Close" or "Copy."

### Chat Bubbles
- **User:** Electric Iris purple, right-aligned, white text. Tapered bottom-right corner.
- **Agent:** White/Panel surface, 1px border, left-aligned, Primary Ink text. Tapered bottom-left corner. Includes a "typing" indicator with three staggered bouncing dots.

### Input Fields
- **Floating Dock:** Pinned to bottom, frosted glass effect.
- **Textarea:** Dynamic auto-expanding height (up to 160px), no-resize, Primary Iris border on focus.

### Tree Navigation
- **Vault Items:** Recursive rows with a subtle 0.3s hover transition. Use Tertiary Lavender for the background of the active/selected note. Include a monospace disclosure arrow and a right-aligned numeric count for folders.

### The Knowledge Graph
- **Nodes:** Circle radius scales with degree (connectivity). Inactive nodes are Muted Slate; active/queried nodes pulse in Primary Iris.
- **Physics:** Nodes should exhibit a harmonic "breathing" oscillation. Responses from the AI should trigger a kinetic "expansion pulse" that decays over 1-2 seconds.