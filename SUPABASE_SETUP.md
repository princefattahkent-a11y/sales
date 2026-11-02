# Supabase setup

The app uses individual Supabase Auth accounts for cashiers and stores one shared sales summary per Sunday. Public sign-up should remain disabled.

## Connect the app

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. In Supabase **Project Settings → API**, copy the Project URL and anon/public key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. In **Authentication → Providers → Email**, enable email/password sign-in and turn off public sign-ups. Configure the project's site URL and redirect URLs for the development and deployed app URLs.
6. In **Authentication → Users**, invite each cashier by email. They can sign in with their password or request an email sign-in link from the app; the app only sends links for existing invited accounts. To show their name in saved summaries, include `full_name` in the user's metadata; otherwise the email address is shown.
7. Restart the Vite development server after changing `.env.local`.

Do not put a service role key in the frontend or `.env.local`; the browser only uses the anon/public key and the database policies restrict access to authenticated users.

## Run locally

```sh
npm install
npm run dev
```

## Data and attribution

`sales_summaries` has one row per Sunday date. The `recorded_by` user is set when a cashier first saves that date. The database update trigger preserves that original cashier and creation timestamp when another team member edits the record. The linked profile's `display_name` is shown, falling back to its email.

The application calculates total amount worked as MTN + Airtel + cash deposited, and cash at hand as cash deposited − expenses. The SQL schema rejects non-Sunday dates and negative amounts.
