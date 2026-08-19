# BharatYatra + Supabase

All persistent data is stored in Supabase: authentication, user profiles,
bookings, charter requests, payments, and shared seat availability. There is
no local PostgreSQL database or custom API server.

## One-time Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the complete contents of `schema.sql`. Run it again after updating this project so the `bus_id` field used by the seat lookup is added.
3. In `config.js`, paste the project URL and **anon/public** key from
   Settings -> API. Never put a `service_role` key in this browser file.
4. Replace the sample email in the `admins` insert in `schema.sql` with the
   email that should access the admin dashboard, then run it.
5. In Supabase Authentication, enable email/password sign-in. Configure
   Google only if the Google sign-in button will be used.

## Run locally

```powershell
npm install
npm start
```

Open http://localhost:4000. The local server only serves static files;
Supabase provides the database and authentication.
