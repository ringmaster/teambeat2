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