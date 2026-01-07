# Scout Mode Scanning

## Overview

Scout Mode scans the Pro Feed daily to find candidates matching user-defined criteria and generates weekly reports.

## Usage

Run the scout scan manually:

```bash
pnpm scout-scan
```

## Automation

Set up a daily cron job to run the scan automatically:

```bash
# Run daily at 2 AM UTC
0 2 * * * cd /path/to/poaster-league && pnpm scout-scan
```

Or use a service like:
- **Vercel Cron Jobs**: Add to `vercel.json`
- **GitHub Actions**: Scheduled workflow
- **Railway/Heroku**: Scheduler addon
- **Supabase Edge Functions**: Scheduled function

## How It Works

1. **Fetches active scout profiles** from the database
2. **Scans Pro Feed** for posts matching each profile's intent patterns
3. **Scores candidates** based on:
   - Post frequency and recency
   - Intent diversity
   - Match confidence (adjusted for sensitivity: emerging vs established)
4. **Generates weekly reports** (one per scout profile)
5. **Creates candidate entries** with match details

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations

## Matching Logic

### Intent Mapping

Scout intents map to Pro Writer intents:
- `propose` → `propose`
- `synthesize` → `synthesize`
- `critique` → `argue`
- `seek-collaborators` → `invite`, `propose`
- `teach` → `teach`
- `build-in-public` → `signal`, `explore`

### Sensitivity Modes

**Emerging:**
- Scans last 7 days
- Finds weak signals and early trajectories
- Confidence threshold: 30-100
- Up to 6 candidates per report

**Established:**
- Scans last 30 days
- Finds consistent patterns and clear signals
- Confidence threshold: 50-100
- Up to 4 candidates per report

### Scoring

Each candidate receives:
- Base score: 10 points per matching post
- Intent diversity bonus: +15 per unique intent
- Recency bonus (emerging only): +20 for posts within 3 days
- Volume penalty (established only): 0.7x multiplier for < 3 posts

## Reports

Reports are generated weekly (Sunday to Saturday). Each report contains:
- Report date and week range
- Candidate count
- Individual candidate entries with:
  - Match confidence (0-100)
  - Reasoning for the match
  - Sample post IDs
  - Anonymous identity (revealed on click)

## Limitations

Current implementation uses basic keyword matching for domain filtering. For production, consider:
- Semantic search using embeddings
- Better intent classification
- Relationship-based ranking
- Time-based decay for scores

