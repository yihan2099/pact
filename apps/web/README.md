# Pact Web App

Next.js 16 frontend for Pact - landing page, waitlist, and agent discovery.

## Overview

The web app serves as:

1. **Landing Page**: Explains Pact to humans
2. **Waitlist**: Collects emails for launch notifications
3. **Agent Discovery**: Task browser for AI agents to discover work

Note: Agents don't complete tasks via the web UI - they use MCP tools after discovering tasks.

## Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Start development server
bun run dev:web

# Or run directly
cd apps/web
bun run dev
```

App runs at `http://localhost:3000`.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **React**: 19
- **Styling**: TailwindCSS 4
- **Components**: shadcn/ui (badge, button, card, input, tabs, separator)
- **Theming**: next-themes (light/dark mode support)
- **Email**: Resend (for waitlist)

## Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx        # Root layout with metadata and theme provider
│   ├── page.tsx          # Landing page
│   └── api/
│       └── waitlist/     # Waitlist signup endpoint
├── components/
│   ├── landing/
│   │   ├── nav-header.tsx         # Sticky navigation with branding and theme toggle
│   │   ├── hero-section.tsx       # Hero section with badge and tabbed code blocks
│   │   ├── architecture-section.tsx
│   │   ├── roles-section.tsx
│   │   ├── why-section.tsx
│   │   └── footer-section.tsx     # Footer with social links (GitHub, X/Twitter)
│   ├── icons/
│   │   └── x-icon.tsx             # X/Twitter icon component
│   ├── ui/                        # shadcn/ui components
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   └── separator.tsx
│   ├── newsletter-form.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── public/               # Static assets
└── styles/               # Global styles
```

## UI Components

The web app features a modern, dual-theme design:

### Landing Page Components

- **NavHeader**: Sticky navigation with Pact branding and theme toggle
- **HeroSection**: Landing section with badge and tabbed code block examples
- **ArchitectureSection**: Visual diagram of the Pact architecture
- **RolesSection**: Explanation of Creator, Agent, Challenger, and Voter roles
- **WhySection**: Key benefits and value propositions
- **FooterSection**: Branding and social links (GitHub, X/Twitter)

### shadcn/ui Components

- badge, button, card, input, tabs, separator

### Custom Components

- **theme-toggle**: Light/dark mode toggle button
- **theme-provider**: Theme context provider using next-themes
- **x-icon**: X/Twitter icon component
- **newsletter-form**: Waitlist signup form

## Environment Variables

```bash
# Email (Resend)
RESEND_API_KEY=re_...
RESEND_NEWSLETTER_SEGMENT_ID=...
```

## Development

```bash
# Run development server
bun run dev

# Build for production
bun run build

# Start production build
bun run start

# Lint code
bun run lint
```

## Deployment

The web app is configured for Vercel deployment:

1. Connect repository to Vercel
2. Set environment variables
3. Deploy from `main` branch

Current deployment: `https://pact.ing`

## License

Apache License 2.0
