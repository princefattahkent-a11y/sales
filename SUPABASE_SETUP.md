# Supabase setup

The app allows cashiers to create accounts, but a newly registered account cannot view or record sales until an admin approves it. Email confirmation is required before a request appears in the admin queue.

## Connect the app

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. In Supabase **Project Settings → API**, copy the Project URL and anon/public key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `supabase/schema.sql` in the Supabase SQL Editor. It also upgrades the earlier sales-summary schema if it was already applied; existing cashiers become pending and must be approved.
5. In **Authentication → Providers → Email**, enable email/password sign-in, allow new users to sign up, and keep email confirmation enabled. Configure **Authentication → URL Configuration** with the app's site URL and development/deployed redirect URLs.
6. Start the app and create the administrator account through **Create an account**. Confirm that account's email.
7. In the SQL Editor, promote that confirmed account to the first administrator, replacing the email below:

   ```sql
   update public.profiles
   set role = 'admin', approval_status = 'approved'
   where email = 'admin@example.com' and email_confirmed_at is not null;
   ```

8. The administrator signs in and opens **Approvals** to approve or decline confirmed cashier signup requests. New users must confirm their email before their request appears in that queue.
9. Restart the Vite development server after changing `.env.local`.

Do not put a service role key in the frontend or `.env.local`. The browser uses only the anon/public key; row-level security restricts sales access to approved accounts and signup review to admins.

## Run locally

```sh
npm install
npm run dev
```

## Data, access, and attribution

`profiles` stores each account's name, email verification time, role, and approval status. New accounts start as pending cashiers. The admin review action uses a database function that checks the caller's admin role; the browser cannot change approval status or grant itself admin access.

Only approved accounts can read, create, or update `sales_summaries`. Admins can read pending signup profiles. Approved team members can read approved profile names for cashier attribution. A sales record's `recorded_by` user is set when a cashier first saves that Sunday, and database triggers preserve the original cashier when the record is edited.

The application calculates total amount worked as MTN + Airtel + cash deposited, and cash at hand as cash deposited − expenses. The SQL schema rejects non-Sunday dates and negative amounts.

When upgrading an existing project, rerun `supabase/schema.sql` to apply the approved-team delete policy used by the History page's Delete action.
