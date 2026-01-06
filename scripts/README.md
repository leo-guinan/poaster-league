# Scripts

## populate-feed.ts

Populates the Poaster League feed with tweets from the last 24 hours from Community Archive accounts.

### Usage

```bash
pnpm populate-feed
```

### Requirements

1. **Environment Variables** (in `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL` - Main Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - **Required** - Supabase service role key (bypasses RLS policies)
   - `NEXT_PUBLIC_CA_SUPABASE_URL` - Community Archive Supabase URL
   - `NEXT_PUBLIC_CA_SUPABASE_ANON_KEY` - Community Archive anon key

2. **Database Setup**:
   - Run `supabase-schema-placeholders.sql` to create the `placeholder_accounts` table
   - Ensure RLS policies are set up correctly

### What It Does

1. Fetches all accounts from the Community Archive `account` table
2. **Upserts** placeholder accounts for all Community Archive accounts (creates new or updates existing)
3. For each account, fetches their tweets from the last 24 hours from the `tweets` table
4. **Upserts** posts in the Poaster League database (creates new or updates existing)
5. Updates existing posts with latest content and user_id (in case placeholder was claimed)

### Output

- **Placeholder Accounts**: Created/updated for all Community Archive accounts
- **Posts**: Created/updated with:
  - `user_id`: Linked if user exists in main database, otherwise `null` (will be linked when placeholder is claimed)
  - `content`: Tweet text
  - `twitter_post_id`: Original tweet ID (used as unique identifier for upserts)
  - `status`: "published"
  - `post_to_pro_feed`: true
  - `post_to_twitter`: false (already posted)
  - Basic quality checks

### Upsert Behavior

The script uses **upserts** (insert or update) for both placeholder accounts and posts:

- **Placeholder Accounts**: Uses `twitter_user_id` as the unique key. Updates existing records with latest profile info.
- **Posts**: Uses `twitter_post_id` as the unique key. Updates existing posts with:
  - Latest content (in case tweet was edited)
  - Updated `user_id` (if placeholder was claimed since last run)
  - Updated timestamp

This means you can safely run the script multiple times - it will:
- Pick up new accounts and tweets
- Update existing records with any changes
- Fix any bugs or data issues from previous runs

### Notes

- **Service Role Key Required**: The script must use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies. Without it, you'll get "row-level security policy" errors.
- **Placeholder Accounts**: The script creates/updates placeholder accounts for all Community Archive accounts. When someone authenticates with Twitter and their Twitter ID matches a placeholder, the placeholder is automatically claimed and merged into their account.
- **Idempotent**: The script is safe to run multiple times - it won't create duplicates, only updates existing records.
- **No Twitter API**: All data comes from the Community Archive database - no external API calls needed.

### Placeholder Account System

When the script runs, it:
1. Upserts placeholder accounts in the `placeholder_accounts` table for all Community Archive accounts
2. When a user authenticates with Twitter, if their Twitter ID matches a placeholder:
   - The placeholder data (name, handle, etc.) is merged into their user account
   - The placeholder is marked as claimed
   - Future posts will be linked to their account

### Troubleshooting

**RLS Policy Violations**: Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`. The service role key bypasses all RLS policies.

**Missing Tweet Text**: The script logs available column names from the first tweet. Check the output to see what columns are actually available in the `tweets` table.
