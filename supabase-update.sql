-- BharatYatra feature update: reviews, cancellation/refunds, and ticket points.
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New query.

alter table public.bookings add column if not exists bus_id text;
alter table public.bookings add column if not exists boarding_point text;
alter table public.bookings add column if not exists dropping_point text;
alter table public.bookings add column if not exists refund_status text;
alter table public.bookings add column if not exists cancelled_at timestamptz;

create table if not exists public.bus_reviews (
  id         bigint generated always as identity primary key,
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.bus_reviews enable row level security;

create or replace function public.request_booking_cancellation(p_booking_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
  set status = 'cancelled', refund_status = 'requested', cancelled_at = now()
  where id = p_booking_id and user_id = auth.uid() and status = 'confirmed';
  if not found then raise exception 'This booking cannot be cancelled.'; end if;
end;
$$;

grant execute on function public.request_booking_cancellation(bigint) to authenticated;

drop policy if exists "anyone can read reviews" on public.bus_reviews;
create policy "anyone can read reviews" on public.bus_reviews for select using (true);

drop policy if exists "users review their own bookings" on public.bus_reviews;
create policy "users review their own bookings" on public.bus_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.bookings where bookings.id = booking_id and bookings.user_id = auth.uid())
  );

drop policy if exists "admins manage reviews" on public.bus_reviews;
create policy "admins manage reviews" on public.bus_reviews for all
  using (exists (select 1 from public.admins where email = auth.jwt() ->> 'email'));
