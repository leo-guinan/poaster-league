# Scout Mode Implementation Summary

## What Was Built

Scout Mode is now fully implemented as a programmable attention system that scans the Pro Feed for candidates matching user-defined criteria.

## Components Created

### 1. Database Schema
- **Migration**: `supabase-migration-add-scout-reports.sql`
  - Enhanced `scout_profiles` table (config structure)
  - `scout_reports` table (weekly aggregations)
  - `scout_report_candidates` table (individual matches)

### 2. UI Components

#### Scout Setup (`src/components/scout/scout-setup.tsx`)
6-step setup flow:
1. **Intent Shape Selection** - Choose 1-3 intent modes
2. **Domain Definition** - Optional semantic domain constraint
3. **Relationship Target** - Define desired relationship type
4. **Sensitivity Slider** - Emerging vs Established signal focus
5. **Preview Coverage** - Estimate monthly candidates
6. **Activate** - Subscribe at $29/month

#### Scout Reports (`src/components/scout/scout-reports.tsx`)
- Weekly report viewer
- Anonymous candidate display
- Click-to-reveal identity
- Match confidence badges
- Sample post links

#### Updated Scout Page (`src/app/scout/page.tsx`)
- Shows setup flow if no profile exists
- Shows reports dashboard if profile exists
- Subscription management
- Profile configuration

### 3. API Routes

- `POST /api/scout/create` - Create/update scout profile
- `GET /api/scout/profile` - Get user's scout profile
- `POST /api/scout/preview` - Preview coverage estimates
- `GET /api/scout/reports` - List all reports
- `GET /api/scout/reports/[id]` - Get specific report with candidates
- `POST /api/scout/reports/[id]/reveal` - Reveal candidate identity

### 4. Backend Logic

#### Scout Scanning Script (`scripts/scout-scan.ts`)
- Daily scanning of Pro Feed
- Intent pattern matching
- Candidate scoring algorithm
- Weekly report generation
- Domain filtering (basic keyword matching)

## How It Works

1. **User subscribes** → Stripe checkout ($29/month)
2. **User configures scout** → 6-step setup flow
3. **Daily scan** → Runs via cron job (`pnpm scout-scan`)
4. **Weekly reports** → Generated automatically (Sunday-Saturday)
5. **User views reports** → Anonymous candidates with click-to-reveal

## Intent Mapping

Scout intents → Pro Writer intents:
- `propose` → `propose`
- `synthesize` → `synthesize`
- `critique` → `argue`
- `seek-collaborators` → `invite`, `propose`
- `teach` → `teach`
- `build-in-public` → `signal`, `explore`

## Scoring Algorithm

- Base: 10 points per matching post
- Intent diversity: +15 per unique intent
- Recency bonus (emerging): +20 for posts within 3 days
- Volume penalty (established): 0.7x for < 3 posts

Confidence thresholds:
- Emerging: 30-100 (up to 6 candidates)
- Established: 50-100 (up to 4 candidates)

## Next Steps

1. **Set up cron job** for daily scanning (see `scripts/SCOUT_README.md`)
2. **Run migration** in Supabase SQL editor
3. **Test the flow**:
   - Subscribe to Scout Mode
   - Create a scout profile
   - Run `pnpm scout-scan` manually
   - View reports in `/scout`

## Improvements for Production

1. **Semantic search** for domain filtering (currently basic keywords)
2. **Better intent classification** using ML
3. **Relationship-based ranking** (collaborator vs mentor signals)
4. **Time decay** for older posts in scoring
5. **Email notifications** for new reports
6. **Multiple scouts per user** (currently max 1)

## Files Modified

- `src/lib/types/user.ts` - Added Scout types
- `src/components/scout/scout-mode-button.tsx` - Already existed
- `src/app/scout/page.tsx` - Completely rewritten
- `package.json` - Added `scout-scan` script

## Files Created

- `supabase-migration-add-scout-reports.sql`
- `src/components/scout/scout-setup.tsx`
- `src/components/scout/scout-reports.tsx`
- `src/app/api/scout/create/route.ts`
- `src/app/api/scout/profile/route.ts`
- `src/app/api/scout/preview/route.ts`
- `src/app/api/scout/reports/route.ts`
- `src/app/api/scout/reports/[id]/route.ts`
- `src/app/api/scout/reports/[id]/reveal/route.ts`
- `scripts/scout-scan.ts`
- `scripts/SCOUT_README.md`

## Testing Checklist

- [ ] Run database migration
- [ ] Subscribe to Scout Mode
- [ ] Complete setup flow (all 6 steps)
- [ ] Verify profile creation
- [ ] Run scout scan script
- [ ] Verify report generation
- [ ] View reports in UI
- [ ] Test reveal candidate functionality
- [ ] Test subscription cancellation
- [ ] Verify scout button in nav

