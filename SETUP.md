# Poaster League Setup Guide

## Supabase Setup

The app uses Supabase for authentication and user management.

### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Note your project URL and anon key

### 2. Run Database Schema

1. Open your Supabase project SQL Editor
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the SQL to create all tables and policies

### 3. Configure Environment Variables

Create a `.env.local` file in the project root with:

```env
# Supabase (Main App)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Community Archive (Supabase Instance)
NEXT_PUBLIC_CA_SUPABASE_URL=https://fabxmporizzqflnftavs.supabase.co
NEXT_PUBLIC_CA_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYnhtcG9yaXp6cWZsbmZ0YXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjIyNDQ5MTIsImV4cCI6MjAzNzgyMDkxMn0.UIEJiUNkLsW28tBHmG-RQDW-I5JNlJLt62CSk9D_qG8

# Twitter OAuth 2.0
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Configure Supabase Auth

1. In Supabase Dashboard → Authentication → Providers
2. Enable Email provider (or Twitter if you want to use Supabase's Twitter OAuth)
3. Configure redirect URLs:
   - `http://localhost:3000/auth/callback` (for local dev)
   - Your production URL (for production)

## SQLite Removed

SQLite has been completely removed. All data is now stored in Supabase:
- User authentication and profiles
- Twitter OAuth tokens (with automatic refresh)
- Posts and drafts
- Write access requests
- Scout profiles and matches

## User Authentication Flow

### 1. Supabase Auth Setup

The app uses Supabase for authentication. Users can sign in with email/password, then link their Twitter account.

### 2. User States

The app tracks four orthogonal user states:
- **Auth State**: Anonymous or Authenticated
- **Identity State**: Twitter not linked or Twitter linked
- **Write Permission**: Read-only or Write-enabled
- **Scout Status**: Inactive or Active

### 3. Write Access Flow

1. User signs in with Supabase
2. User links Twitter account (required)
3. System checks Community Archive for eligibility
4. If eligible → Write access granted automatically
5. If not eligible → User can request write access (manual review)

## Twitter Integration

To enable cross-posting to Twitter, you need to set up Twitter API credentials using **OAuth 2.0**:

### Option 1: OAuth 2.0 User Context (Recommended for Posting Tweets)

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use an existing one
3. Go to your app's **"Keys and tokens"** section
4. You'll find:
   - **Client ID** (OAuth 2.0)
   - **Client Secret** (OAuth 2.0)

5. Set up OAuth 2.0 User Authentication:
   - Go to **"User authentication settings"** in your app
   - Enable OAuth 2.0
   - Set **App permissions** to "Read and write" (for posting tweets)
   - Add **Callback URI / Redirect URL**: `http://localhost:3000/api/auth/twitter/callback` (for local dev)
   - For production, add your production URL: `https://yourdomain.com/api/auth/twitter/callback`
   - Add **Website URL** (e.g., `http://localhost:3000` for dev, or your production URL)
   - Save settings

6. Create a `.env.local` file in the project root with:

```env
# OAuth 2.0 credentials from Twitter Developer Portal
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here

# Optional: Base URL for OAuth callbacks (defaults to http://localhost:3000)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Note:** Users will connect their Twitter accounts through the OAuth flow in the app. No need to manually obtain access tokens - the app handles this automatically when users click "Connect Twitter" on the write page.

### Option 2: Bearer Token (Simpler, but may have limitations)

If you have a Bearer Token with write permissions:

```env
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

**Important Notes:**
- OAuth 2.0 is now the standard (OAuth 1.0a is deprecated)
- For posting tweets, you need an Access Token with `tweet.write` scope
- Without Twitter credentials, posts will still be saved to the database, but Twitter posting will be disabled
- Access Tokens may expire and need to be refreshed (implement token refresh logic for production)

## API Routes

### Authentication
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/twitter/initiate` - Initiate Twitter OAuth flow
- `GET /api/auth/twitter/callback` - Handle Twitter OAuth callback
- `GET /api/auth/twitter/status` - Check Twitter connection status
- `POST /api/auth/twitter/revoke` - Revoke Twitter connection

### User Management
- `GET /api/user/state` - Get current user state (auth, identity, permissions)
- `POST /api/write-access/request` - Request write access

### Posts
- `POST /api/posts/publish` - Publishes a post (saves to DB + optionally posts to Twitter)
- `POST /api/drafts/save` - Saves a draft to the database

## Database Schema

### Supabase Tables (see `supabase-schema.sql`)

- **users**: User profiles, Twitter identity, write permissions, scout status
- **write_requests**: Write access requests (pending/approved/denied)
- **scout_profiles**: Scout configuration profiles
- **scout_matches**: Scout match results
- **posts**: Published posts (also stored in SQLite for now)
- **drafts**: Unpublished drafts

### SQLite Tables (Legacy - for posts)

- **posts**: Published posts
- **drafts**: Unpublished drafts
- **twitter_auth**: Twitter OAuth tokens (legacy, being migrated to Supabase)

## Community Archive Integration

The app checks the Community Archive (a Supabase instance) to determine write access eligibility.

### Setup

Add to your `.env.local`:

```env
NEXT_PUBLIC_CA_SUPABASE_URL=https://fabxmporizzqflnftavs.supabase.co
NEXT_PUBLIC_CA_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYnhtcG9yaXp6cWZsbmZ0YXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjIyNDQ5MTIsImV4cCI6MjAzNzgyMDkxMn0.UIEJiUNkLsW28tBHmG-RQDW-I5JNlJLt62CSk9D_qG8
```

The app will automatically check if a user's `twitter_user_id` exists in the Community Archive when they link their Twitter account. If found, write access is granted automatically.

**Note:** The implementation tries common table names (`users`, `profiles`, `archive`, `members`) and looks for a `twitter_user_id` or `twitter_id` column. If your Community Archive uses a different schema, update `src/lib/community-archive.ts`.

## Scout Mode

Scout Mode is a $29/month feature that surfaces people matching configured criteria. 

### Implementation Status
- ✅ Scout Mode button in UI
- ✅ Stripe subscription integration
- ✅ Subscription management UI
- ⏳ Scout configuration UI (pending)
- ⏳ Scout matching algorithm (pending)
- ⏳ Scout report UI (pending)

### Stripe Setup

See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for detailed Stripe integration instructions.

## Next Steps

1. Set up Supabase project and run schema
2. Configure environment variables
3. Implement Community Archive API integration
4. Build Scout Mode configuration UI
5. Integrate payment processing for Scout Mode
6. Implement Scout matching algorithm
7. Build Scout report UI

