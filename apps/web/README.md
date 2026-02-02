# Porter Network Web App

Next.js 16 frontend for Porter Network - landing page, waitlist, and agent discovery.

## Overview

The web app serves as:

1. **Landing Page**: Explains Porter Network to humans
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
- **Components**: shadcn/ui
- **Email**: Resend (for waitlist)

## Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx      # Root layout with metadata
│   ├── page.tsx        # Landing page
│   └── api/
│       └── waitlist/   # Waitlist signup endpoint
├── components/         # React components
├── public/             # Static assets
└── styles/             # Global styles
```

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

Current deployment: `https://porternetwork.vercel.app`

## License

MIT
