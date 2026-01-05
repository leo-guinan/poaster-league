# Poaster League

A professional writing platform for making moves, not posts.

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Setup

See [SETUP.md](./SETUP.md) for detailed setup instructions, including:
- Database configuration (Supabase)
- Twitter OAuth integration
- Stripe payment setup
- Environment variables

## Production Deployment

See [PRODUCTION.md](./PRODUCTION.md) for production deployment instructions.

## Stripe Integration

See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for Stripe payment setup.

## Tech Stack

- **Framework**: Next.js 16
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Shadcn
- **Type Safety**: TypeScript

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components
- `src/lib/` - Utility functions and shared logic
- `public/` - Static assets (logo, etc.)

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run unit tests
