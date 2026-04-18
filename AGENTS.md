# AGENTS

## FRONTEND

- Prefer semantic, domain-specific classes over long Tailwind utility strings when a pattern is reused or hard to read.

- Keep Tailwind as the primary styling system for this project. The repo already uses `app/assets/tailwind/application.css` with `@layer components` and `@apply` for shared UI patterns.

- Use inline Tailwind utilities for one-off layout or spacing tweaks that are local and easy to read.

- Extract repeated UI patterns into named component classes in `app/assets/tailwind/application.css`, especially for cards, panels, calendars, overlays, and repeated form structures.

- Prefer semantic classes strongly in HTML generated from JavaScript, such as the schedule picker, where long utility strings make the render logic harder to follow and maintain.