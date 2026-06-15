-- Supabase setup for the Kashmir Weaves static HTML admin panel
--
-- 1) In Supabase Dashboard, open SQL Editor.
-- 2) Admin email is already set to tawfeeqahmadsofi13@gmail.com.
-- 3) Run this whole file.
-- 4) Create the same admin user in Authentication → Users.

-- ============================================================
-- SITE STATE: products, settings, categories, about images
-- ============================================================

create table if not exists public.site_state (
  id text primary key,
  settings jsonb,
  products jsonb,
  categories jsonb,
  about_images jsonb,
  next_id integer,
  updated_at timestamptz default now()
);

insert into public.site_state (id)
values ('main')
on conflict (id) do nothing;

alter table public.site_state enable row level security;

drop policy if exists "Anyone can read site state" on public.site_state;
drop policy if exists "Only admin can insert site state" on public.site_state;
drop policy if exists "Only admin can update site state" on public.site_state;

-- Visitors can read public website data.
create policy "Anyone can read site state"
on public.site_state
for select
to anon, authenticated
using (id = 'main');

-- Only your admin email can write site/admin data.
create policy "Only admin can insert site state"
on public.site_state
for insert
to authenticated
with check (
  id = 'main'
  and lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
);

create policy "Only admin can update site state"
on public.site_state
for update
to authenticated
using (
  id = 'main'
  and lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
)
with check (
  id = 'main'
  and lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
);

grant select on public.site_state to anon, authenticated;
grant insert, update on public.site_state to authenticated;

-- ============================================================
-- ORDERS: order numbers + customer/cart snapshots
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  created_at timestamptz not null default now(),
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  payment_method text,
  payment_reference text,
  status text not null default 'New Order',
  source text default 'website',
  notes text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_order_number_idx on public.orders (order_number);

alter table public.orders enable row level security;

drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Only admin can read orders" on public.orders;
drop policy if exists "Only admin can update orders" on public.orders;

-- Visitors can insert orders from the static website.
-- They cannot read other orders because no SELECT policy is granted to anon.
create policy "Anyone can create orders"
on public.orders
for insert
to anon, authenticated
with check (true);

-- Only your admin email can read all orders in the Admin Panel.
create policy "Only admin can read orders"
on public.orders
for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
);

-- Only your admin email can update order status/details.
create policy "Only admin can update orders"
on public.orders
for update
to authenticated
using (
  lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
)
with check (
  lower(auth.jwt() ->> 'email') = lower('tawfeeqahmadsofi13@gmail.com')
);

grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
