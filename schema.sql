-- =========================================================
-- BharatYatra — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this whole file → Run).
-- =========================================================

-- Extends Supabase's built-in auth.users with the name/phone the site
-- collects at signup, and lets the admin dashboard list registered users
-- (auth.users itself isn't readable from the browser, by design).
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  phone      text,
  created_at timestamptz not null default now()
);

-- Who's allowed into the admin dashboard. Add your own email here.
create table if not exists admins (
  email text primary key
);
insert into admins (email) values ('b9148820@gmail.com') on conflict do nothing;

-- Auto-creates a profile row the instant an account is created (via a
-- database trigger, not client-side code) — this works reliably even
-- if your Supabase project has "Confirm email" turned on, since it
-- doesn't depend on the browser having an active logged-in session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists bookings (
  id              bigint generated always as identity primary key,
  pnr             text not null unique,
  user_id         uuid references auth.users(id) on delete set null,
  passenger_name  text not null,
  passenger_phone text,
  from_city       text not null,
  to_city         text not null,
  journey_date    date not null,
  operator        text,
  bus_type        text,
  departure       text,
  duration        text,
  bus_id          text,
  boarding_point  text,
  dropping_point  text,
  seats           int[] not null default '{}',
  fare_per_seat   int,
  total           int not null default 0,
  discount        int not null default 0,
  promo_code      text,
  payment_method  text,
  payment_id      text,
  status          text not null default 'confirmed',
  refund_status   text,
  cancelled_at    timestamptz,
  booked_at       timestamptz not null default now()
);

-- Safe to run when upgrading an existing Supabase project.
alter table bookings add column if not exists bus_id text;
alter table bookings add column if not exists boarding_point text;
alter table bookings add column if not exists dropping_point text;
alter table bookings add column if not exists refund_status text;
alter table bookings add column if not exists cancelled_at timestamptz;

create table if not exists bus_reviews (
  id         bigint generated always as identity primary key,
  booking_id bigint not null unique references bookings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

create or replace function request_booking_cancellation(p_booking_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'cancelled', refund_status = 'requested', cancelled_at = now()
  where id = p_booking_id and user_id = auth.uid() and status = 'confirmed';
  if not found then raise exception 'This booking cannot be cancelled.'; end if;
end;
$$;

grant execute on function request_booking_cancellation(bigint) to authenticated;

create table if not exists charter_requests (
  ref          text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  name         text not null,
  phone        text,
  email        text,
  purpose      text,
  from_city    text not null,
  to_city      text not null,
  journey_date date not null,
  return_date  date,
  passengers   int,
  bus_count    int not null default 1,
  bus_type     text,
  notes        text,
  fare_per_day int,
  fare_total   int,
  requested_at timestamptz not null default now()
);

create table if not exists charter_payments (
  id          bigint generated always as identity primary key,
  charter_ref text not null references charter_requests(ref) on delete cascade,
  amount      int not null,
  payment_id  text not null,
  paid_at     timestamptz not null default now()
);

-- One row per specific bus (route + date + which bus in the results
-- list), tracking exactly which seat numbers are actually taken.
create table if not exists bus_seats (
  bus_id       text primary key,
  booked_seats int[] not null default '{}',
  updated_at   timestamptz not null default now()
);

-- Reserves seats atomically — if two people try to grab the same seat
-- at once, the second call raises an error instead of double-booking.
-- Called from the browser via supabase.rpc('reserve_seats', ...).
create or replace function reserve_seats(p_bus_id text, p_seats int[])
returns void
language plpgsql
security definer
as $$
declare
  existing int[];
begin
  insert into bus_seats (bus_id, booked_seats) values (p_bus_id, '{}')
    on conflict (bus_id) do nothing;

  select booked_seats into existing from bus_seats where bus_id = p_bus_id for update;

  if existing && p_seats then
    raise exception 'One or more of your selected seats were just booked by someone else. Please pick different seats.';
  end if;

  update bus_seats set booked_seats = existing || p_seats, updated_at = now()
    where bus_id = p_bus_id;
end;
$$;

grant execute on function reserve_seats(text, int[]) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY — this is what makes it safe to call
-- Supabase directly from the browser with a public key.
-- =========================================================
alter table profiles          enable row level security;
alter table admins            enable row level security;
alter table bookings          enable row level security;
alter table charter_requests  enable row level security;
alter table charter_payments  enable row level security;
alter table bus_seats         enable row level security;
alter table bus_reviews       enable row level security;

-- profiles: you can create/read your own row; admins can read everyone's
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users read own profile" on profiles
  for select using (auth.uid() = id);
create policy "admins read all profiles" on profiles
  for select using (exists (select 1 from admins where email = auth.jwt() ->> 'email'));

-- admins: any logged-in user can check membership (needed for the
-- policies above to work) — this only exposes the list of admin
-- emails, nothing more sensitive.
create policy "authenticated can check admin membership" on admins
  for select using (auth.role() = 'authenticated');

-- bookings: you can create your own booking; admins can see/edit/delete all
create policy "users insert own booking" on bookings
  for insert with check (auth.uid() = user_id);
create policy "users read own bookings" on bookings
  for select using (auth.uid() = user_id);
create policy "admins manage bookings" on bookings
  for all using (exists (select 1 from admins where email = auth.jwt() ->> 'email'));

create policy "anyone can read reviews" on bus_reviews for select using (true);
create policy "users review their own bookings" on bus_reviews for insert
  with check (auth.uid() = user_id and exists (select 1 from bookings where bookings.id = booking_id and bookings.user_id = auth.uid()));
create policy "admins manage reviews" on bus_reviews for all
  using (exists (select 1 from admins where email = auth.jwt() ->> 'email'));

-- charter requests: anyone can submit one (no login required, matching
-- the site's charter form); admins can see/edit/delete all
create policy "anyone can submit charter request" on charter_requests
  for insert with check (true);
create policy "admins manage charter requests" on charter_requests
  for all using (exists (select 1 from admins where email = auth.jwt() ->> 'email'));

-- charter payments: anyone can record one against a request; admins manage all
create policy "anyone can record charter payment" on charter_payments
  for insert with check (true);
create policy "admins manage charter payments" on charter_payments
  for all using (exists (select 1 from admins where email = auth.jwt() ->> 'email'));

-- bus seats: anyone can check what's taken (writes only ever happen
-- through the reserve_seats() function above, not directly)
create policy "anyone can view seat availability" on bus_seats
  for select using (true);
