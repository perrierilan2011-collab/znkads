-- ============================================================
--  ZNK Ads — Schéma Supabase (PostgreSQL)
--  À exécuter dans l'éditeur SQL de votre projet Supabase.
--  Toute la logique sensible vit côté serveur (service_role) :
--  RLS est activé et aucune policy publique n'est créée.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  Utilisateurs
-- ------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  discord_id    text unique not null,
  username      text not null,
  display_name  text,
  avatar        text,
  email         text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ------------------------------------------------------------
--  Portefeuilles (montants en CENTIMES)
-- ------------------------------------------------------------
create table if not exists public.wallets (
  user_id           uuid primary key references public.users(id) on delete cascade,
  balance_cents     integer not null default 0 check (balance_cents >= 0),
  total_earned_cents integer not null default 0,
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Campagnes publicitaires (offres fournies par la régie)
-- ------------------------------------------------------------
create table if not exists public.ad_campaigns (
  id               text primary key,
  title            text not null,
  advertiser       text,
  category         text,
  reward_cents     integer not null default 0,
  duration_seconds integer not null default 30,
  network          text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Vues publicitaires
-- ------------------------------------------------------------
create table if not exists public.ad_views (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  offer_id          text not null,
  ad_title          text not null,
  advertiser        text,
  reward_cents      integer not null default 0,
  status            text not null default 'pending'
                    check (status in ('pending','awaiting_confirmation','validated','rejected','expired')),
  session_token     text unique not null,
  network_reference text,
  created_at        timestamptz not null default now(),
  finished_at       timestamptz,
  validated_at      timestamptz,
  ip                text,
  user_agent        text
);

-- ------------------------------------------------------------
--  Demandes de retrait
-- ------------------------------------------------------------
create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  method        text not null,
  destination   text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','paid','rejected')),
  note          text,
  ticket_url    text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references public.users(id)
);

-- ------------------------------------------------------------
--  Index
-- ------------------------------------------------------------
create index if not exists idx_ad_views_user      on public.ad_views (user_id, created_at desc);
create index if not exists idx_ad_views_status    on public.ad_views (status);
create index if not exists idx_withdrawals_user   on public.withdrawals (user_id, created_at desc);
create index if not exists idx_withdrawals_status on public.withdrawals (status);

-- ------------------------------------------------------------
--  Sécurité : RLS activé, aucune policy publique.
--  L'application accède aux données via la clé service_role.
-- ------------------------------------------------------------
alter table public.users         enable row level security;
alter table public.wallets       enable row level security;
alter table public.ad_campaigns  enable row level security;
alter table public.ad_views      enable row level security;
alter table public.withdrawals   enable row level security;

-- ------------------------------------------------------------
--  credit_ad_view : SEUL point de crédit d'un solde.
--  Appelé par le postback signé de la régie publicitaire.
--  Idempotent : une vue ne peut être créditée qu'une seule fois.
-- ------------------------------------------------------------
create or replace function public.credit_ad_view(
  p_token         text,
  p_reference     text,
  p_revenue_cents integer
)
returns table (ok boolean, status text, balance_cents integer)
language plpgsql
security definer
as $$
declare
  v_view   public.ad_views%rowtype;
  v_amount integer := greatest(coalesce(p_revenue_cents, 0), 0);
  v_balance integer;
begin
  select * into v_view
    from public.ad_views
   where session_token = p_token
   for update;

  if not found then
    return query select false, 'not_found'::text, null::integer;
    return;
  end if;

  if v_view.status = 'validated' then
    select balance_cents into v_balance from public.wallets where user_id = v_view.user_id;
    return query select true, 'validated'::text, coalesce(v_balance, 0);
    return;
  end if;

  if v_view.status not in ('pending', 'awaiting_confirmation') then
    return query select false, v_view.status, null::integer;
    return;
  end if;

  update public.ad_views
     set status            = 'validated',
         network_reference = p_reference,
         validated_at      = now(),
         reward_cents      = v_amount
   where id = v_view.id;

  insert into public.wallets (user_id, balance_cents, total_earned_cents, updated_at)
  values (v_view.user_id, v_amount, v_amount, now())
  on conflict (user_id) do update
     set balance_cents      = public.wallets.balance_cents + v_amount,
         total_earned_cents = public.wallets.total_earned_cents + v_amount,
         updated_at         = now()
  returning balance_cents into v_balance;

  return query select true, 'validated'::text, coalesce(v_balance, 0);
end;
$$;

-- ------------------------------------------------------------
--  request_withdrawal : vérifie le solde et le réserve atomiquement.
-- ------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_user_id     uuid,
  p_amount      integer,
  p_method      text,
  p_destination text
)
returns table (ok boolean, withdrawal_id uuid, balance_cents integer, reason text)
language plpgsql
security definer
as $$
declare
  v_balance  integer;
  v_wd_id    uuid;
begin
  if p_amount is null or p_amount <= 0 then
    return query select false, null::uuid, null::integer, 'invalid_amount'::text;
    return;
  end if;

  select balance_cents into v_balance
    from public.wallets
   where user_id = p_user_id
   for update;

  if v_balance is null then
    return query select false, null::uuid, null::integer, 'wallet_not_found'::text;
    return;
  end if;

  if v_balance < p_amount then
    return query select false, null::uuid, v_balance, 'insufficient_funds'::text;
    return;
  end if;

  update public.wallets
     set balance_cents = balance_cents - p_amount,
         updated_at    = now()
   where user_id = p_user_id
   returning balance_cents into v_balance;

  insert into public.withdrawals (user_id, amount_cents, method, destination, status)
  values (p_user_id, p_amount, p_method, p_destination, 'pending')
  returning id into v_wd_id;

  return query select true, v_wd_id, v_balance, null::text;
end;
$$;

-- ------------------------------------------------------------
--  reject_withdrawal : refuse une demande et recrédite le solde.
-- ------------------------------------------------------------
create or replace function public.reject_withdrawal(
  p_id    uuid,
  p_admin uuid,
  p_note  text
)
returns public.withdrawals
language plpgsql
security definer
as $$
declare
  v_wd public.withdrawals%rowtype;
begin
  select * into v_wd from public.withdrawals where id = p_id for update;
  if not found then
    return null;
  end if;

  if v_wd.status in ('pending', 'approved') then
    update public.wallets
       set balance_cents = balance_cents + v_wd.amount_cents,
           updated_at    = now()
     where user_id = v_wd.user_id;
  end if;

  update public.withdrawals
     set status       = 'rejected',
         note         = p_note,
         processed_by = p_admin,
         processed_at = now()
   where id = p_id
   returning * into v_wd;

  return v_wd;
end;
$$;

-- ------------------------------------------------------------
--  Exemple de campagne (à adapter / supprimer en production)
-- ------------------------------------------------------------
-- insert into public.ad_campaigns (id, title, advertiser, category, reward_cents, duration_seconds, network)
-- values ('camp_001', 'Découvrez notre partenaire', 'Partenaire', 'Vidéo', 10, 30, 'VotreRegie')
-- on conflict (id) do nothing;
