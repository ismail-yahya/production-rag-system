You are an expert UI/UX Designer and Frontend Developer specializing in Next.js, Tailwind CSS, and shadcn/ui.

I have a fully functional, standalone SaaS project. Programmatically, it does everything I need, but it currently lacks any visual styling. I need you to redesign and provide the styling code for this project.

**CRITICAL RULES:**

1. DO NOT change the project structure, architecture, or component logic.
2. DO NOT rewrite any of the business logic, API calls (Axios), state management (Zustand, TanStack Query), or form handling (React Hook Form + Zod).
3. Your task is STRICTLY to provide styling code, Tailwind classes, shadcn/ui theme variables, and CSS configurations. If you provide component code, it should only be the exact same component I provided, but with added/updated `className` attributes.
4. The design must be exceptionally clean, minimalistic, and modern.

**Tech Stack (for your awareness, do not modify):**

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Zustand (UI state only)
- React Hook Form + Zod
- Axios
- React Markdown

**Design Aesthetic: "Terminal CLI meets Glassmorphism"**
I want a unique, clean, SaaS-style design that blends a retro-modern Command-Line Interface (Terminal) aesthetic with modern Glassmorphism.

**Visual Language Guidelines:**

1. **Color Palette:** Dark mode base (deep blacks/charcoals like `#0a0a0a` or `#111111`).
2. **Glassmorphism Elements:** Panels, cards, and modals should use semi-transparent backgrounds (e.g., `bg-white/5`), backdrop blur (`backdrop-blur-md`), and subtle, thin borders (e.g., `border-white/10`).
3. **Terminal/CLI Accents:**
   - Use Monospace fonts (like JetBrains Mono or Geist Mono) for headings, labels, numbers, and terminal-like UI elements.
   - Use standard clean sans-serif for long-form body text and Markdown content for readability.
   - Incorporate terminal prompts (e.g., `>`, `$`, `~`) as decorative elements in headings or input fields.
   - Accent colors should be terminal-inspired: neon green (`#00ff9d`), cyber amber (`#ffb000`), or terminal blue (`#0ff`), used sparingly for primary actions, active states, and focus rings.
4. **Shadcn/ui Customization:** Override the default shadcn theme variables to fit the glassmorphism and terminal aesthetic. Inputs should look like terminal command lines (transparent backgrounds, bottom borders or subtle glowing borders on focus). Buttons should be minimal, perhaps with a slight glass effect and monospace text.
5. **Markdown Styling:** Since I use React Markdown, provide CSS/Tailwind styles for the markdown container so that code blocks look like actual terminal windows, and text remains highly readable against the dark glass background.

**Your Output Format:**

1. **Tailwind v4 Config / Global CSS:** Provide the exact CSS variables and base styles needed to achieve this theme (colors, fonts, glassmorphism utilities).
2. **shadcn/ui Theme Overrides:** Instructions on how to tint the shadcn components to match.
3. **Component Styling:** When I provide you with a component, return ONLY the styled version of that component with the `className` properties updated.

If you understand these instructions, reply with: "System Initialized. Awaiting component input or global CSS request to begin Terminal-Glassmorphism styling."
