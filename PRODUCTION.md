# Production Deployment Guide

## Vercel Deployment

### Required Environment Variables

Set these in your Vercel project settings:

#### Supabase (Main App)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

#### Community Archive
- `NEXT_PUBLIC_CA_SUPABASE_URL` - Community Archive Supabase URL
- `NEXT_PUBLIC_CA_SUPABASE_ANON_KEY` - Community Archive anon key

#### Twitter OAuth 2.0
- `TWITTER_CLIENT_ID` - Twitter OAuth 2.0 Client ID
- `TWITTER_CLIENT_SECRET` - Twitter OAuth 2.0 Client Secret
- `NEXT_PUBLIC_BASE_URL` - Your production URL (e.g., `https://yourdomain.com`)

### Deployment Steps

1. **Connect to Vercel**
   ```bash
   vercel
   ```

2. **Set Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all required variables listed above
   - Make sure to set them for Production, Preview, and Development environments

3. **Configure Supabase**
   - Update Supabase Auth settings:
     - Add your Vercel URL to "Site URL"
     - Add `https://yourdomain.com/api/auth/twitter/callback` to "Redirect URLs"

4. **Configure Twitter OAuth**
   - Update Twitter Developer Portal:
     - Add `https://yourdomain.com/api/auth/twitter/callback` to Callback URLs
     - Update Website URL to your production domain

5. **Deploy**
   ```bash
   vercel --prod
   ```

## Security Checklist

- ✅ Pre-commit hooks prevent secrets from being committed
- ✅ Build checks run before pushes
- ✅ Sensitive logging removed (using production-safe logger)
- ✅ Environment variables validated
- ✅ Error messages don't expose sensitive information
- ✅ SQLite removed (all data in Supabase)
- ✅ RLS policies enabled in Supabase

## Monitoring

- Set up error tracking (Sentry, LogRocket, etc.)
- Monitor Supabase usage and limits
- Set up alerts for failed authentication attempts
- Monitor Twitter API rate limits

## Performance

- Enable Vercel Analytics
- Set up caching headers for static assets
- Consider CDN for Supabase assets
- Monitor database query performance

## Backup & Recovery

- Supabase provides automatic backups
- Export database schema regularly
- Keep environment variable backups (securely)

