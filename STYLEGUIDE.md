# TeamBeat Style Guide

## Color System Philosophy

TeamBeat uses a semantic color system where color variables describe their **purpose** rather than their appearance. This makes the codebase more maintainable and allows for easier theming and design system evolution.

### ❌ Avoid: Color-Named Variables
```css
/* BAD - describes appearance, not purpose */
--color-red-500
--color-blue-600 
--color-gray-200
```

### ✅ Use: Semantic Color Variables
```css
/* GOOD - describes purpose and context */
--color-danger
--input-border-focus
--surface-elevated
```

## Core Brand Colors

TeamBeat uses a carefully coordinated 5-color family as the foundation for all colored UI elements. These colors work harmoniously together and should be used for all non-monochrome interface elements:

```less
// TeamBeat Brand Color Family - 5 coordinated colors for all controls
@brand-primary: #39495C;        // Primary brand color (confirmed)
@brand-secondary: #395A5C;      // Teal-leaning secondary
@brand-tertiary: #3B395C;       // Purple-leaning tertiary
@brand-accent: #5C3B39;         // Warm accent color
@brand-complement: #5A5C39;     // Earth tone complement

// Semantic assignments from the brand family
@interactive-primary: @brand-primary;      // Main interactive elements
@interactive-secondary: @brand-secondary;  // Secondary actions
@interactive-tertiary: @brand-tertiary;    // Alternative actions
@interactive-accent: @brand-accent;        // Highlighting and focus states
@surface-accent: @brand-complement;        // Subtle surface accents
```

### CSS Variables for Brand Colors
- `--color-primary` - Main brand color (#39495C) for headers, primary buttons
- `--color-primary-hover` - Lightened hover state for primary elements
- `--color-primary-active` - Darkened active/pressed state for primary elements
- `--color-secondary` - Teal-leaning secondary color (#395A5C) for supporting elements
- `--color-secondary-hover` - Lightened hover state for secondary elements
- `--color-tertiary` - Purple-leaning tertiary color (#3B395C) for alternative actions
- `--color-tertiary-hover` - Lightened hover state for tertiary elements
- `--color-accent` - Warm accent color (#5C3B39) for interactive highlights and focus states
- `--color-accent-hover` - Lightened hover state for accent elements

### Design Principle: 5-Color Harmony
All buttons, interactive elements, and colored components should use colors from this coordinated family. This creates visual cohesion and ensures that no element feels out of place in the interface.

## Text Colors

Semantic text colors for consistent typography hierarchy:

- `--color-text-primary` - Main body text, headings
- `--color-text-secondary` - Secondary text, subheadings  
- `--color-text-muted` - Placeholder text, disabled states
- `--color-text-inverse` - Text on dark backgrounds (white)

## Surface Colors

Background colors for different UI surfaces and elevation levels:

- `--color-bg-primary` - Main page background
- `--color-bg-secondary` - Card/panel backgrounds  
- `--color-bg-muted` - Subtle background areas
- `--surface-elevated` - Elevated surfaces (modals, dropdowns)
- `--surface-primary` - Primary content surfaces
- `--surface-secondary` - Secondary/muted surfaces
- `--surface-hover` - Hover state for interactive surfaces

## Interactive Colors

Colors specifically for interactive elements:

- `--interactive-hover` - General hover state background
- `--interactive-selected` - Selected state background
- `--interactive-focus-ring` - Focus ring color for accessibility

## Input & Form Colors

Dedicated colors for form controls and inputs:

- `--input-border` - Default border for form inputs
- `--input-border-focus` - Focus state border for inputs
- `--input-background-disabled` - Background for disabled inputs
- `--input-placeholder` - Placeholder text color in inputs

## Status & Feedback Colors

Semantic colors for communicating different states and feedback:

### Error/Danger States
- `--color-danger` - Error text, destructive actions
- `--color-danger-hover` - Hover state for danger elements
- `--status-error-bg` - Background for error messages/states
- `--status-error-text` - Text color for error states

### Warning States  
- `--color-warning` - Warning text and elements
- `--color-warning-hover` - Hover state for warning elements
- `--status-warning-bg` - Background for warning messages
- `--status-warning-text` - Text color for warning states

### Success States
- `--color-success` - Success text and elements
- `--color-success-hover` - Hover state for success elements  
- `--status-success-bg` - Background for success messages
- `--status-success-text` - Text color for success states

### Info States
- `--color-info` - Information text and elements
- `--color-info-hover` - Hover state for info elements
- `--status-info-bg` - Background for info messages
- `--status-info-text` - Text color for info states

## Component-Specific Colors

### Avatar Colors
- `--avatar-gradient-start` - Start color for avatar gradients
- `--avatar-gradient-end` - End color for avatar gradients

### Card Colors
- `--card-border-color` - Border color for cards
- `--card-background` - Background color for cards
- `--card-text-primary` - Primary text color within cards
- `--card-text-secondary` - Secondary text color within cards  
- `--card-hover-background` - Background when hovering cards
- `--card-selection-highlight` - Color for selected cards
- `--card-interactive-highlight` - Interactive accent color for cards

#### Card Action Button Colors
- `--card-delete-button-color` - Delete button icon color
- `--card-delete-button-hover` - Delete button hover color
- `--card-delete-button-background` - Delete button background
- `--card-vote-button-background` - Vote button background
- `--card-vote-button-hover` - Vote button hover state
- `--card-comment-button-background` - Comment button background
- `--card-comment-button-hover` - Comment button hover state

### Button Colors

Button colors are derived from the 5-color brand family, providing multiple semantic button types:

**Primary Button Family (using brand colors):**
- `--btn-primary-bg` - Primary button (#39495C) for main actions
- `--btn-primary-bg-hover` - Lightened hover state
- `--btn-primary-text` - Text color (white)

**Secondary Button Family:**
- `--btn-secondary-bg` - Secondary button (#395A5C) for supporting actions  
- `--btn-secondary-bg-hover` - Lightened hover state
- `--btn-secondary-text` - Text color (white)
- `--btn-secondary-border` - Border color

**Tertiary Button Family:**
- `--btn-tertiary-bg` - Tertiary button (#3B395C) for alternative actions
- `--btn-tertiary-bg-hover` - Lightened hover state
- `--btn-tertiary-text` - Text color (white)

**Accent Button Family:**
- `--btn-accent-bg` - Accent button (#5C3B39) for highlighting/focus actions
- `--btn-accent-bg-hover` - Lightened hover state
- `--btn-accent-text` - Text color (white)

**Unselected/Inactive Button Family:**
- `--btn-unselected-bg` - Very subtle background for unselected options (8% opacity primary)
- `--btn-unselected-bg-hover` - Slightly more visible on hover (15% opacity primary)
- `--btn-unselected-text` - Primary color text for contrast
- `--btn-unselected-border` - Subtle border (20% opacity primary)

**Semantic Action Buttons:**
- `--btn-danger-bg` - Destructive action button background
- `--btn-danger-bg-hover` - Destructive button hover background
- `--btn-danger-text` - Destructive button text color

### Border Colors

- `--color-border` - Default border color for components
- `--color-border-hover` - Border color on hover states
- `--color-border-focus` - Border color for focused elements

### Title Bar Colors

- `--title-bar-background` - Background color for title bars
- `--title-bar-color` - Text color for title bar content

## Usage Guidelines

### 1. Brand Color Family Priority
Always use colors from the 5-color brand family for UI controls and interactive elements:

**Color Assignment Strategy:**
- **Primary (#39495C)**: Main actions, headers, primary buttons
- **Secondary (#395A5C)**: Supporting actions, secondary buttons, highlights
- **Tertiary (#3B395C)**: Alternative actions, tertiary buttons, avatars
- **Accent (#5C3B39)**: Focus states, interactive highlights, call-to-action elements
- **Complement (#5A5C39)**: Subtle accents, surface variations, background highlights

**Examples of Proper Usage:**
```css
/* ✅ GOOD - Using brand family colors */
.primary-button {
    background-color: var(--btn-primary-bg);     /* #39495C */
    color: var(--btn-primary-text);
}

.secondary-action {
    background-color: var(--btn-secondary-bg);   /* #395A5C */
    color: var(--btn-secondary-text);
}

.focus-highlight {
    border-color: var(--interactive-focus-ring); /* #5C3B39 */
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent);
}
```

### 2. Always Use Semantic Names
When adding new color usage, create or use semantic variable names that describe the purpose:

```css
/* ✅ GOOD */
.notification-error {
    background-color: var(--status-error-bg);
    color: var(--status-error-text);
    border: 1px solid var(--color-danger);
}

/* ❌ BAD */
.notification-error {
    background-color: #fee;
    color: #dc2626; 
    border: 1px solid red;
}
```

### 2. Layer Your Color Usage
Use the hierarchical color system:
1. Start with brand colors for identity
2. Use surface colors for backgrounds and elevation
3. Apply text colors for typography hierarchy
4. Add semantic status colors for feedback
5. Use component-specific colors for specialized elements

### 3. Maintain Consistency
- Interactive elements should use `--interactive-*` or `--card-interactive-highlight`
- Form elements should use `--input-*` variables
- Status feedback should use `--status-*-bg` and `--status-*-text` pairs
- Hover states should have consistent naming: `--*-hover`

### 4. Accessibility Considerations
- Ensure adequate contrast ratios between text and background colors
- Don't rely solely on color to convey information
- Use the semantic status colors consistently to build user expectations

## Color Modification

### LESS Functions
The color system uses LESS functions for consistent color manipulation:

```less
// Lighten/darken for hover states
--color-primary-hover: lighten(@brand-primary, 10%);
--color-danger-hover: darken(@brand-danger, 10%);

// Fade for transparent overlays
--card-shadow: fade(@neutral-black, 10%);
```

### CSS color-mix() for Opacity
For modern opacity handling, use CSS `color-mix()`:

```css
/* Transparent overlays */
background: color-mix(in srgb, var(--color-primary) 10%, transparent);
box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
```

## Migration Guide

When updating existing code that uses color-named variables:

1. **Identify the purpose** of the color usage
2. **Map to the appropriate semantic variable** from this guide
3. **Test the visual result** to ensure it matches the design intent
4. **Consider context** - the same visual color might use different semantic variables depending on its purpose

### Common Migrations

| Old Color Variable | New Semantic Variable | Context |
|-------------------|----------------------|---------|
| `--color-gray-50` | `--surface-elevated` | Background surfaces |
| `--color-gray-100` | `--surface-primary` | Card/panel backgrounds |
| `--color-gray-200` | `--input-border` | Form input borders |
| `--color-gray-400` | `--input-placeholder` | Placeholder text |
| `--color-gray-500` | `--color-text-muted` | Secondary text |
| `--color-gray-700` | `--color-text-secondary` | Supporting text |
| `--color-gray-900` | `--color-text-primary` | Main content text |
| `--color-blue-500` | `--input-border-focus` | Focus states |
| `--color-red-500` | `--color-danger` | Error text/buttons |
| `--color-red-100` | `--status-error-bg` | Error backgrounds |
| `--color-teal-500` | `--card-interactive-highlight` | Interactive accents |

This semantic color system ensures consistency, maintainability, and makes the design system more intuitive for developers working with the codebase.

## Layout Patterns

### Spacing System
TeamBeat uses a consistent spacing scale based on 0.25rem (4px) increments:

- `--spacing-1`: 0.25rem (4px)
- `--spacing-2`: 0.5rem (8px)
- `--spacing-3`: 0.75rem (12px)
- `--spacing-4`: 1rem (16px)
- `--spacing-5`: 1.25rem (20px)
- `--spacing-6`: 1.5rem (24px)
- `--spacing-8`: 2rem (32px)
- `--spacing-12`: 3rem (48px)

**Common Usage:**
- Gap between elements: `--spacing-2` to `--spacing-4`
- Component padding: `--spacing-4` to `--spacing-6`
- Section spacing: `--spacing-6` to `--spacing-8`
- Page margins: `--spacing-8` to `--spacing-12`

### Border Radius System
- `--radius-sm`: 0.125rem - Small elements, badges
- `--radius-md`: 0.375rem - Inputs, buttons (default)
- `--radius-lg`: 0.5rem - Cards, modals
- `--radius-xl`: 0.75rem - Large cards
- `--radius-full`: 9999px - Pills, circular elements

### Container Widths
- Forms/narrow content: `max-width: 800px`
- Wide content (dashboards, results): `max-width: 1200px`
- Page container: `max-width: 80rem` (1280px)
- Modals: `max-width: 28rem` (448px)
- Large modals: `max-width: 64rem` (1024px)

### Responsive Padding
Components should increase padding at breakpoints:
```css
padding: 1.5rem; /* mobile */
@media (min-width: 768px) {
    padding: 2rem; /* tablet+ */
}
```

## Button Patterns

### Primary Button
Standard primary action button using brand colors:
```css
.btn-primary {
    padding: 0.625rem 1.5rem;
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
    min-height: 44px; /* Touch-friendly */
}

.btn-primary:hover {
    background: var(--btn-primary-bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-primary:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
}
```

### Secondary Button
Supporting actions with lighter styling:
```css
.btn-secondary {
    padding: 0.625rem 1.5rem;
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
    min-height: 44px;
}

.btn-secondary:hover {
    background: var(--btn-secondary-bg-hover);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}
```

### Danger Button
Destructive actions in red:
```css
.btn-danger {
    background: var(--btn-danger-bg);
    color: var(--btn-danger-text);
    /* Same structure as primary */
}

.btn-danger:hover {
    background: var(--btn-danger-bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}
```

### Button Sizing
- Padding: `0.5rem 1rem` (compact) to `0.625rem 1.5rem` (standard)
- Font size: `0.875rem` (14px)
- Min height: `44px` for touch-friendliness
- Font weight: `500` to `600`

## Form Input Patterns

### Text Input
Standard text input styling:
```css
.input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.875rem;
    background-color: white;
    transition: all 0.2s ease;
    min-height: 44px;
}

.input:hover {
    border-color: var(--color-border-hover);
}

.input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.input::placeholder {
    color: var(--color-text-muted);
}
```

### Textarea
Vertically resizable text area:
```css
textarea.input {
    resize: vertical;
    min-height: 120px;
    line-height: 1.6;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; /* For code */
}
```

### Select Dropdown
```css
.select {
    /* Same base styling as .input */
    cursor: pointer;
}
```

## Content Box Patterns

**Important Note**: The application has a specialized `Card.svelte` component used for board cards with voting, comments, and reactions. These patterns are for generic content containers and list items - **do not use `.card` as a class name** to avoid confusion with the board card component.

### Standard Content Box
Basic container for content grouping:
```css
.content-box {
    padding: 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: white;
    box-shadow: var(--shadow-sm);
}
```

### Interactive Content Box
Containers that respond to hover (e.g., datasource cards, list items):
```css
.content-box-interactive {
    padding: 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
    position: relative;
}

.content-box-interactive::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--color-accent), var(--color-secondary));
    opacity: 0;
    transition: opacity 0.2s ease;
}

.content-box-interactive:hover {
    background-color: var(--surface-elevated);
    border-color: var(--color-primary);
    transform: translateX(4px);
    box-shadow: var(--shadow-md);
}

.content-box-interactive:hover::before {
    opacity: 1;
}
```

**Alternative Class Names for Specific Use Cases:**
- `.datasource-card`, `.scorecard-item`, `.question-item` - Specific component list items
- `.list-item` - Generic list items in configuration pages
- `.question-summary-item` - Survey question summary items

### Content Box with Gradient Background
Subtle gradient for visual interest:
```css
.content-box-gradient {
    background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-primary) 3%, transparent),
        color-mix(in srgb, var(--color-secondary) 3%, transparent)
    );
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}
```

## Empty State Patterns

### Standard Empty State
Centered message for empty content areas:
```css
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px; /* Or min-height */
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 0.9375rem;
    padding: var(--spacing-6);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-primary) 2%, transparent),
        color-mix(in srgb, var(--color-secondary) 2%, transparent)
    );
}

.empty-state p {
    margin: 0.5rem 0;
}
```

## Loading & Error State Patterns

### Loading State
```css
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-secondary);
    gap: 1.5rem;
    padding: 2rem;
}

.loading-state p {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text-primary);
}
```

### Error State
```css
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-secondary);
    gap: 1.5rem;
    padding: 2rem;
}

.error-state p {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text-primary);
}

/* Retry button in error state */
.error-state button {
    padding: 0.625rem 1.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
}
```

## Shadow & Elevation Patterns

### Shadow Scale
- `--shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` - Subtle depth
- `--shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1)` - Standard cards
- `--shadow-lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1)` - Elevated elements
- `--shadow-xl`: `0 20px 25px -5px rgb(0 0 0 / 0.1)` - Modals, popovers

### Usage Guidelines
- Resting elements: `var(--shadow-sm)`
- Hover states: Increase to `var(--shadow-md)`
- Cards: `var(--shadow-sm)` resting, `var(--shadow-md)` hover
- Modals/Dialogs: `var(--shadow-xl)`

## Typography Patterns

### Heading Hierarchy
```css
h2 {
    margin: 0 0 var(--spacing-6) 0;
    font-size: 1.75rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

h3 {
    margin: 0 0 var(--spacing-3) 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

h4 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
}
```

### Body Text
- Primary: `0.875rem` to `0.9375rem`, weight `400` to `500`
- Secondary/meta: `0.8125rem` to `0.875rem`, color `var(--color-text-secondary)`
- Muted: `0.875rem`, color `var(--color-text-muted)`

### Text Colors
- Primary content: `var(--color-text-primary)`
- Supporting text: `var(--color-text-secondary)`
- Placeholder/disabled: `var(--color-text-muted)`

## Common Component Combinations

### Section Header with Action
```html
<div class="section-header">
    <h3>Section Title</h3>
    <button class="btn-primary">+ Add Item</button>
</div>
```

```css
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}
```

### Form Group
```html
<div class="form-group">
    <label for="field">Field Label</label>
    <input id="field" type="text" class="input" />
    <p class="help-text">Optional help text</p>
</div>
```

```css
.form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
}

.form-group label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
}

.help-text {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
    font-style: italic;
}
```