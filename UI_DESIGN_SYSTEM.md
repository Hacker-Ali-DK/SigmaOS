# UI Design System

Recovery+ employs a modern, dark-mode exclusive "Glassmorphic" design system built on top of Tailwind CSS 4.0.

## 1. Color Palette (Semantic)
The application avoids generic browser colors in favor of a curated, harmonious HSL palette.
- **Canvas/Background:** Deep Slate `#03050C`
- **Surface/Cards:** `#0B0F19` with slight opacity gradients.
- **Primary Brand/Interactive:** Vibrant Cyan/Blue `#3A86FF` (Used for active tabs, primary buttons, focus rings).
- **Success/Deen/Clean:** Emerald `#02C39A` (Used for on-time prayers, clean streaks).
- **Warning/Late:** Amber `#FFB703` (Used for late prayers, moderate dopamine urges).
- **Danger/Missed:** Rose `#E63946` (Used for missed prayers, severe relapses).

## 2. Typography
- **Primary Font:** `Inter` (Sans-serif)
- **Heading Font:** `Outfit` (Geometric Sans) - Used for major view titles and the central Recovery Score.
- **Monospace:** `JetBrains Mono` - Used for exact timestamps and numerical data points.

## 3. UI Components

### Cards (`.card-primary`, `.card-secondary`, `.card-tertiary`)
- Implemented as global CSS utility classes in `src/app/globals.css`.
- Feature rounded corners (`rounded-2xl` or `rounded-3xl`), semi-transparent backgrounds, and subtle borders (`border-slate-800/60`) to create a "glass" effect against the dark canvas.

### Buttons (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-destructive`)
- Standardized padding and rounded corners (`rounded-xl`).
- **Interactive Polish:** Buttons utilize `active:scale-[0.98]` or `active:scale-[0.95]` for tactile press feedback.
- **Accessibility:** All interactive elements feature a high-contrast blue focus ring (`focus-visible:ring-2 focus-visible:ring-[#3A86FF] focus-visible:outline-none`).

### Inputs (`.input-base`)
- Inputs and textareas share a unified dark-glass aesthetic with placeholder text colored `text-slate-500`.

### Navigation
- **Top/Header:** Minimalist. Usually contains a "Back" button and the View Title.
- **Bottom Navigation / Radial Menu:** Mobile-first floating action button or fixed bottom bar depending on the viewport. Note: The custom Radial Menu was retained per user requirement.

## 4. Responsive Behavior
- **Mobile First:** The application was initially designed exclusively for mobile viewports (`max-w-md`).
- **Desktop Optimization:** In Phase 4, responsive breakpoints (`md`, `lg`) were introduced.
  - The main application shell centers content with a `max-w-md mx-auto md:max-w-4xl xl:max-w-6xl` container.
  - Grids (like Habits and Goals) transition from 1 column on mobile to 2-3 columns on tablet/desktop.
  - The dashboard utilizes a side-by-side layout (Alignment ring on left, timelines/routines on right) on larger screens.

## 5. Branding / Assets
- **Logo/Mascot:** The "Sigma Dragon" asset is retained as the primary splash screen and branding element.
- **Splash Screen:** Displays the branding upon initial app load.
