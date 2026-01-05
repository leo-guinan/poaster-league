# Stripe Integration Setup Guide

This guide will help you set up Stripe for Scout Mode subscriptions ($29/month).

## 1. Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Complete account setup
3. Switch to **Test Mode** for development

## 2. Create Product and Price

1. In Stripe Dashboard, go to **Products** → **Add Product**
2. Create a product:
   - **Name**: Scout Mode
   - **Description**: Monthly subscription for Scout Mode
   - **Pricing**: 
     - **Price**: $29.00
     - **Billing period**: Monthly (recurring)
   - Click **Save product**
3. Copy the **Price ID** (starts with `price_...`)

## 3. Get API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - **Secret key** (starts with `sk_test_...` or `sk_live_...`)

## 4. Set Up Webhook

### For Local Development (using Stripe CLI):

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the **webhook signing secret** (starts with `whsec_...`)

### For Production:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_...`)

## 5. Configure Environment Variables

Add to your `.env.local`:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Product/Price
STRIPE_SCOUT_MODE_PRICE_ID=price_...

# Stripe Webhook
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 6. Run Database Migration

Run the Stripe subscription schema:

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste contents of `supabase-schema-stripe.sql`
3. Run the SQL

This creates:
- `subscriptions` table to track Stripe subscriptions
- Automatic sync between subscription status and `users.scout_active`
- Proper RLS policies

## 7. Test the Integration

### Test Cards (Test Mode):

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Use any future expiry date, any CVC, any ZIP

### Test Flow:

1. Click "Subscribe to Scout Mode" button
2. Complete checkout with test card
3. Verify subscription appears in Stripe Dashboard
4. Verify `users.scout_active` is set to `true` in Supabase
5. Verify subscription status shows in `/scout` page

## 8. Go Live

When ready for production:

1. Switch Stripe Dashboard to **Live Mode**
2. Create live product/price (same as test)
3. Update environment variables with live keys
4. Set up production webhook endpoint
5. Update `NEXT_PUBLIC_BASE_URL` to production URL

## Troubleshooting

### Webhook not receiving events:
- Verify webhook URL is correct
- Check webhook signing secret matches
- Ensure endpoint is publicly accessible (for production)
- Check Stripe Dashboard → Webhooks → Events for delivery logs

### Subscription not activating:
- Check webhook logs in Stripe Dashboard
- Verify database migration ran successfully
- Check Supabase logs for errors
- Verify `STRIPE_WEBHOOK_SECRET` matches webhook endpoint

### Checkout not working:
- Verify `STRIPE_SECRET_KEY` and `STRIPE_SCOUT_MODE_PRICE_ID` are set
- Check browser console for errors
- Verify Stripe keys are in correct mode (test vs live)

