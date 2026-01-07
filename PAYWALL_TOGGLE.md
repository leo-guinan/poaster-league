# Scout Mode Paywall Toggle

## Overview

The Scout Mode paywall can be toggled on/off using the `NEXT_PUBLIC_PAYWALL_LIVE` environment variable. This allows testing Scout Mode with early users before requiring payments.

## Configuration

**Environment Variable:** `NEXT_PUBLIC_PAYWALL_LIVE`

**Default:** `false` (paywall is OFF)

**Values:**
- `"true"` - Paywall is ON (requires Stripe subscription)
- `"false"` or unset - Paywall is OFF (free access for authenticated users)

## How It Works

### When Paywall is OFF (`NEXT_PUBLIC_PAYWALL_LIVE=false`):

1. **API Route (`/api/scout/create`)**: Skips subscription check
2. **User State**: Checks for scout profile instead of subscription status
3. **UI Components**:
   - Scout Mode button shows "Scout Mode" (not "Subscribe to Scout Mode")
   - Clicking button navigates directly to scout page (no Stripe checkout)
   - Subscription management UI is hidden
   - Setup flow activates profile immediately (no payment required)

### When Paywall is ON (`NEXT_PUBLIC_PAYWALL_LIVE=true`):

1. **API Route**: Requires active Stripe subscription
2. **User State**: Checks `scout_active` field (synced from subscription)
3. **UI Components**:
   - Scout Mode button shows "Subscribe to Scout Mode" when inactive
   - Clicking button redirects to Stripe checkout
   - Subscription management UI is visible
   - Setup flow redirects to Stripe checkout after configuration

## Files Modified

1. **`src/lib/env.ts`** - Added `paywallLive` config (defaults to `false`)
2. **`src/app/api/scout/create/route.ts`** - Conditional subscription check
3. **`src/lib/user-state.ts`** - Checks scout profile when paywall is off
4. **`src/components/scout/scout-mode-button.tsx`** - Conditional button text and behavior
5. **`src/app/scout/page.tsx`** - Conditional UI rendering based on paywall status
6. **`src/components/scout/scout-setup.tsx`** - Skips Stripe checkout when paywall is off

## Usage

### For Testing (Paywall OFF):

```bash
# .env.local or environment variables
NEXT_PUBLIC_PAYWALL_LIVE=false
```

Or simply don't set the variable (defaults to `false`).

### For Production (Paywall ON):

```bash
# .env.local or environment variables
NEXT_PUBLIC_PAYWALL_LIVE=true
```

## Behavior Matrix

| Paywall Status | User Has Profile | Subscription | Access Granted | UI Shows |
|---------------|------------------|--------------|----------------|----------|
| OFF           | Yes              | N/A          | ✅ Yes         | Reports Dashboard |
| OFF           | No               | N/A          | ✅ Yes         | Setup Flow |
| ON            | Yes              | Active       | ✅ Yes         | Reports Dashboard |
| ON            | Yes              | Inactive     | ❌ No          | Subscribe Button |
| ON            | No               | Active       | ✅ Yes         | Setup Flow |
| ON            | No               | Inactive     | ❌ No          | Subscribe Button |

## Notes

- When paywall is OFF, authenticated users can create scout profiles without payment
- Scout profiles work the same regardless of paywall status
- Weekly reports and scanning logic are unaffected by paywall status
- When turning paywall ON, existing profiles remain active (users need to subscribe)
- The environment variable must be `NEXT_PUBLIC_` prefixed to be accessible in client components

