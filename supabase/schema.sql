-- ============================================================
-- ZNK ADS - Schema Supabase
-- A executer dans : Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  discord_username text not null default '',
  discord_avatar text,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  total_earned_cents bigint not null default 0 check (total_earned_cents >= 0),
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint users_discord_id_key unique (discord_id),
  constraint users_referral_code_key unique (referral_code),
  constraint users_discord_id_format check (discord_id ~ '^[0-9]{5,32}$'),
  constraint users_referral_code_format check (referral_code ~ '^[A-Z0-9]{4,16}$')
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (
    type in (
      'ad_reward',
      'referral_signup',
      'referral_ad',
      'withdrawal_request',
      'withdrawal_refund',
      'adjustment'
    )
  ),
  amount_cents bigint not null check (amount_cents <> 0),
  description text not null default '',
  reference_id text,
  created_at timestamptz not null default now()
);

-- Empeche le double credit d'une meme reference (idempotence).
create unique index if not exists transactions_user_type_reference_key
  on public.transactions (user_id, type, reference_id)
  where reference_id is not null;

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  referral_code text not null,
  signup_reward_paid boolean not null default false,
  ad_reward_paid boolean not null default false,
  status text not null default 'pending' check (
    status in ('pending', 'signup_paid', 'completed')
  ),
  created_at timestamptz not null default now(),
  constraint referrals_referred_id_key unique (referred_id),
  constraint referrals_no_self_referral check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

create table if not exists public.ad_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  provider_reference text not null,
  status text not null default 'started' check (
    status in ('started', 'validated', 'rejected', 'expired')
  ),
  reward_cents bigint not null default 0 check (reward_cents >= 0),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ad_sessions_provider_reference_key unique (provider, provider_reference)
);

create index if not exists ad_sessions_user_status_validated_idx
  on public.ad_sessions (user_id, status, validated_at desc);

create index if not exists ad_sessions_user_created_idx
  on public.ad_sessions (user_id, created_at desc);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'accepted', 'rejected', 'paid')
  ),
  discord_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_user_created_idx
  on public.withdrawals (user_id, created_at desc);

create index if not exists withdrawals_status_created_idx
  on public.withdrawals (status, created_at desc);

-- ------------------------------------------------------------
-- TRIGGER updated_at
-- ------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists withdrawals_touch_updated_at on public.withdrawals;
create trigger withdrawals_touch_updated_at
before update on public.withdrawals
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- FONCTIONS ATOMIQUES
-- Toutes les modifications de solde passent par ces fonctions.
-- ------------------------------------------------------------

-- Demarre une session publicitaire avec une reference generee serveur.
create or replace function public.start_ad_session(
  p_user_id uuid,
  p_provider text,
  p_reward_cents bigint,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_day_start timestamptz;
  v_validated_today integer;
  v_active_today integer;
  v_reference text;
  v_session public.ad_sessions%rowtype;
begin
  if p_daily_limit < 1 then
    raise exception 'invalid_amount';
  end if;

  if p_reward_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_provider is null or length(trim(p_provider)) = 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  v_day_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  -- Une session abandonnee ne doit pas bloquer la limite quotidienne.
  update public.ad_sessions
  set status = 'expired'
  where user_id = p_user_id
    and status = 'started'
    and created_at < now() - interval '30 minutes';

  select count(*) into v_validated_today
  from public.ad_sessions
  where user_id = p_user_id
    and status = 'validated'
    and validated_at >= v_day_start;

  select count(*) into v_active_today
  from public.ad_sessions
  where user_id = p_user_id
    and status = 'started'
    and created_at >= v_day_start;

  if (v_validated_today + v_active_today) >= p_daily_limit then
    return jsonb_build_object(
      'status', 'daily_limit_reached',
      'validated_today', v_validated_today,
      'daily_limit', p_daily_limit
    );
  end if;

  v_reference := replace(gen_random_uuid()::text, '-', '');

  insert into public.ad_sessions (
    user_id,
    provider,
    provider_reference,
    status,
    reward_cents
  )
  values (
    p_user_id,
    p_provider,
    v_reference,
    'started',
    p_reward_cents
  )
  returning * into v_session;

  return jsonb_build_object(
    'status', 'started',
    'session_id', v_session.id,
    'reference', v_session.provider_reference,
    'reward_cents', v_session.reward_cents,
    'validated_today', v_validated_today,
    'daily_limit', p_daily_limit
  );
end;
$$;

-- Valide une publicite apres postback authentifie de la regie.
-- Idempotent : une session deja validee ne peut jamais etre creditee deux fois.
create or replace function public.credit_ad_reward(
  p_user_id uuid,
  p_provider text,
  p_provider_reference text,
  p_reward_cents bigint,
  p_daily_limit integer,
  p_referral_required_ads integer,
  p_referral_ad_reward_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_session public.ad_sessions%rowtype;
  v_day_start timestamptz;
  v_validated_today integer;
  v_total_validated integer;
  v_referral public.referrals%rowtype;
  v_referral_credited boolean := false;
begin
  if p_reward_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_daily_limit < 1 then
    raise exception 'invalid_amount';
  end if;

  -- Verrou utilisateur : serialise tous les credits d'un meme compte.
  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  select * into v_session
  from public.ad_sessions
  where provider = p_provider
    and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'session_not_found';
  end if;

  if v_session.user_id <> p_user_id then
    raise exception 'session_user_mismatch';
  end if;

  if v_session.status = 'validated' then
    select count(*) into v_total_validated
    from public.ad_sessions
    where user_id = p_user_id and status = 'validated';

    return jsonb_build_object(
      'status', 'already_processed',
      'balance_cents', v_user.balance_cents,
      'total_earned_cents', v_user.total_earned_cents,
      'validated_ads', v_total_validated,
      'referral_ad_reward_credited', false
    );
  end if;

  if v_session.status <> 'started' then
    raise exception 'invalid_session_status';
  end if;

  v_day_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  select count(*) into v_validated_today
  from public.ad_sessions
  where user_id = p_user_id
    and status = 'validated'
    and validated_at >= v_day_start;

  if v_validated_today >= p_daily_limit then
    update public.ad_sessions
    set status = 'rejected'
    where id = v_session.id;

    return jsonb_build_object(
      'status', 'daily_limit_reached',
      'validated_today', v_validated_today,
      'daily_limit', p_daily_limit
    );
  end if;

  update public.ad_sessions
  set status = 'validated',
      validated_at = now(),
      reward_cents = p_reward_cents
  where id = v_session.id;

  update public.users
  set balance_cents = balance_cents + p_reward_cents,
      total_earned_cents = total_earned_cents + p_reward_cents
  where id = p_user_id
  returning * into v_user;

  insert into public.transactions (
    user_id,
    type,
    amount_cents,
    description,
    reference_id
  )
  values (
    p_user_id,
    'ad_reward',
    p_reward_cents,
    'Publicite validee',
    p_provider || ':' || p_provider_reference
  );

  select count(*) into v_total_validated
  from public.ad_sessions
  where user_id = p_user_id and status = 'validated';

  -- Palier de parrainage : le parrain est credite une seule fois.
  select * into v_referral
  from public.referrals
  where referred_id = p_user_id
  for update;

  if v_referral.id is not null
     and not v_referral.ad_reward_paid
     and p_referral_ad_reward_cents > 0
     and v_total_validated >= p_referral_required_ads then

    update public.referrals
    set ad_reward_paid = true,
        status = 'completed'
    where id = v_referral.id;

    update public.users
    set balance_cents = balance_cents + p_referral_ad_reward_cents,
        total_earned_cents = total_earned_cents + p_referral_ad_reward_cents
    where id = v_referral.referrer_id;

    insert into public.transactions (
      user_id,
      type,
      amount_cents,
      description,
      reference_id
    )
    values (
      v_referral.referrer_id,
      'referral_ad',
      p_referral_ad_reward_cents,
      'Palier de parrainage atteint',
      'referral-ad:' || v_referral.id::text
    );

    v_referral_credited := true;
  end if;

  return jsonb_build_object(
    'status', 'credited',
    'balance_cents', v_user.balance_cents,
    'total_earned_cents', v_user.total_earned_cents,
    'validated_ads', v_total_validated,
    'referral_ad_reward_credited', v_referral_credited
  );
end;
$$;

-- Enregistre un parrain et credite le bonus d'inscription (une seule fois).
create or replace function public.register_referral(
  p_referrer_id uuid,
  p_referred_id uuid,
  p_referral_code text,
  p_signup_reward_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_referrer public.users%rowtype;
begin
  if p_referrer_id = p_referred_id then
    raise exception 'self_referral';
  end if;

  if p_signup_reward_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_referrer
  from public.users
  where id = p_referrer_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  perform 1 from public.users where id = p_referred_id;
  if not found then
    raise exception 'user_not_found';
  end if;

  insert into public.referrals (
    referrer_id,
    referred_id,
    referral_code,
    signup_reward_paid,
    status
  )
  values (
    p_referrer_id,
    p_referred_id,
    p_referral_code,
    p_signup_reward_cents > 0,
    case when p_signup_reward_cents > 0 then 'signup_paid' else 'pending' end
  )
  on conflict (referred_id) do nothing
  returning * into v_referral;

  if v_referral.id is null then
    return jsonb_build_object('status', 'already_exists');
  end if;

  if p_signup_reward_cents > 0 then
    update public.users
    set balance_cents = balance_cents + p_signup_reward_cents,
        total_earned_cents = total_earned_cents + p_signup_reward_cents
    where id = p_referrer_id;

    insert into public.transactions (
      user_id,
      type,
      amount_cents,
      description,
      reference_id
    )
    values (
      p_referrer_id,
      'referral_signup',
      p_signup_reward_cents,
      'Bonus de parrainage (inscription)',
      'referral-signup:' || v_referral.id::text
    );
  end if;

  return jsonb_build_object(
    'status', 'created',
    'referral_id', v_referral.id,
    'signup_reward_paid', p_signup_reward_cents > 0
  );
end;
$$;

-- Cree une demande de retrait et reserve immediatement le montant.
create or replace function public.request_withdrawal(
  p_user_id uuid,
  p_amount_cents bigint,
  p_discord_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_withdrawal public.withdrawals%rowtype;
begin
  if p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  if v_user.balance_cents < p_amount_cents then
    raise exception 'insufficient_balance';
  end if;

  update public.users
  set balance_cents = balance_cents - p_amount_cents
  where id = p_user_id;

  insert into public.withdrawals (
    user_id,
    amount_cents,
    status,
    discord_id
  )
  values (
    p_user_id,
    p_amount_cents,
    'pending',
    p_discord_id
  )
  returning * into v_withdrawal;

  insert into public.transactions (
    user_id,
    type,
    amount_cents,
    description,
    reference_id
  )
  values (
    p_user_id,
    'withdrawal_request',
    -p_amount_cents,
    'Demande de retrait',
    'withdrawal:' || v_withdrawal.id::text
  );

  return jsonb_build_object(
    'status', 'pending',
    'withdrawal_id', v_withdrawal.id,
    'amount_cents', p_amount_cents,
    'balance_cents', v_user.balance_cents - p_amount_cents
  );
end;
$$;

-- Met a jour le statut d'un retrait. Un refus rembourse le solde reserve.
create or replace function public.update_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal public.withdrawals%rowtype;
  v_old_status text;
  v_refunded boolean := false;
begin
  if p_status not in ('pending', 'processing', 'accepted', 'rejected', 'paid') then
    raise exception 'invalid_status';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'withdrawal_not_found';
  end if;

  v_old_status := v_withdrawal.status;

  if v_old_status = p_status then
    return jsonb_build_object(
      'status', p_status,
      'changed', false,
      'refunded', false,
      'withdrawal_id', v_withdrawal.id
    );
  end if;

  if v_old_status in ('paid', 'rejected') then
    raise exception 'invalid_transition';
  end if;

  if not (
    (v_old_status = 'pending' and p_status in ('processing', 'accepted', 'rejected'))
    or (v_old_status = 'processing' and p_status in ('accepted', 'rejected'))
    or (v_old_status = 'accepted' and p_status in ('paid', 'rejected'))
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.withdrawals
  set status = p_status,
      updated_at = now()
  where id = p_withdrawal_id;

  if p_status = 'rejected' then
    update public.users
    set balance_cents = balance_cents + v_withdrawal.amount_cents
    where id = v_withdrawal.user_id;

    insert into public.transactions (
      user_id,
      type,
      amount_cents,
      description,
      reference_id
    )
    values (
      v_withdrawal.user_id,
      'withdrawal_refund',
      v_withdrawal.amount_cents,
      'Retrait refuse - remboursement',
      'withdrawal-refund:' || v_withdrawal.id::text
    );

    v_refunded := true;
  end if;

  return jsonb_build_object(
    'status', p_status,
    'changed', true,
    'refunded', v_refunded,
    'withdrawal_id', v_withdrawal.id,
    'amount_cents', v_withdrawal.amount_cents
  );
end;
$$;

-- ------------------------------------------------------------
-- SECURITE : RLS + droits
-- ------------------------------------------------------------

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.ad_sessions enable row level security;
alter table public.withdrawals enable row level security;

-- Aucune policy pour anon/authenticated : l'acces direct depuis le navigateur
-- est totalement refuse. Le serveur Next.js utilise la service_role key et
-- filtre chaque requete par l'utilisateur de la session signee.
revoke all on table public.users from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
revoke all on table public.ad_sessions from anon, authenticated;
revoke all on table public.withdrawals from anon, authenticated;

revoke all on function public.start_ad_session(uuid, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.credit_ad_reward(uuid, text, text, bigint, integer, integer, bigint) from public, anon, authenticated;
revoke all on function public.register_referral(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.update_withdrawal_status(uuid, text) from public, anon, authenticated;

grant execute on function public.start_ad_session(uuid, text, bigint, integer) to service_role;
grant execute on function public.credit_ad_reward(uuid, text, text, bigint, integer, integer, bigint) to service_role;
grant execute on function public.register_referral(uuid, uuid, text, bigint) to service_role;
grant execute on function public.request_withdrawal(uuid, bigint, text) to service_role;
grant execute on function public.update_withdrawal_status(uuid, text) to service_role;

-- ============================================================
-- CASINO
-- Toutes les mises et tous les gains passent par ces fonctions.
-- Le resultat des jeux est calcule cote serveur (crypto.randomInt).
-- ============================================================

-- Nouveaux types de transactions.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'ad_reward',
    'referral_signup',
    'referral_ad',
    'withdrawal_request',
    'withdrawal_refund',
    'adjustment',
    'casino_bet',
    'casino_win',
    'casino_refund'
  )
);

create table if not exists public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game text not null check (
    game in ('slots', 'blackjack', 'roulette', 'mines', 'coinflip', 'dice')
  ),
  bet_cents bigint not null check (bet_cents > 0),
  payout_cents bigint not null default 0 check (payout_cents >= 0),
  status text not null default 'active' check (
    status in ('active', 'won', 'lost', 'push', 'cancelled')
  ),
  version integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists casino_rounds_user_created_idx
  on public.casino_rounds (user_id, created_at desc);

create index if not exists casino_rounds_user_status_idx
  on public.casino_rounds (user_id, status);

create index if not exists casino_rounds_status_updated_idx
  on public.casino_rounds (status, updated_at desc);

-- Une seule partie active par joueur et par jeu (protection anti-double clic).
create unique index if not exists casino_rounds_one_active_idx
  on public.casino_rounds (user_id, game)
  where status = 'active';

drop trigger if exists casino_rounds_touch_updated_at on public.casino_rounds;
create trigger casino_rounds_touch_updated_at
before update on public.casino_rounds
for each row execute function public.touch_updated_at();

-- Jeu instantane : debit de la mise et credit du gain dans la meme transaction.
create or replace function public.casino_instant_bet(
  p_user_id uuid,
  p_game text,
  p_bet_cents bigint,
  p_payout_cents bigint,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_round public.casino_rounds%rowtype;
  v_status text;
begin
  if p_bet_cents <= 0 or p_payout_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  if p_game not in ('slots', 'roulette', 'coinflip', 'dice') then
    raise exception 'invalid_game';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  if v_user.balance_cents < p_bet_cents then
    raise exception 'insufficient_balance';
  end if;

  v_status := case
    when p_payout_cents > p_bet_cents then 'won'
    when p_payout_cents = p_bet_cents then 'push'
    else 'lost'
  end;

  update public.users
  set balance_cents = balance_cents - p_bet_cents + p_payout_cents
  where id = p_user_id
  returning * into v_user;

  insert into public.casino_rounds (
    user_id, game, bet_cents, payout_cents, status, state, result
  )
  values (
    p_user_id, p_game, p_bet_cents, p_payout_cents, v_status, '{}'::jsonb,
    coalesce(p_result, '{}'::jsonb)
  )
  returning * into v_round;

  insert into public.transactions (
    user_id, type, amount_cents, description, reference_id
  )
  values (
    p_user_id, 'casino_bet', -p_bet_cents, 'Mise casino',
    'casino-bet:' || v_round.id::text
  );

  if p_payout_cents > 0 then
    insert into public.transactions (
      user_id, type, amount_cents, description, reference_id
    )
    values (
      p_user_id, 'casino_win', p_payout_cents, 'Gain casino',
      'casino-win:' || v_round.id::text
    );
  end if;

  return jsonb_build_object(
    'round_id', v_round.id,
    'status', v_status,
    'balance_cents', v_user.balance_cents,
    'payout_cents', p_payout_cents
  );
end;
$$;

-- Demarre une partie a etats (blackjack, mines) et reserve la mise.
create or replace function public.casino_start_round(
  p_user_id uuid,
  p_game text,
  p_bet_cents bigint,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_round public.casino_rounds%rowtype;
begin
  if p_bet_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_game not in ('blackjack', 'mines') then
    raise exception 'invalid_game';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  if v_user.balance_cents < p_bet_cents then
    raise exception 'insufficient_balance';
  end if;

  perform 1
  from public.casino_rounds
  where user_id = p_user_id
    and game = p_game
    and status = 'active';

  if found then
    raise exception 'round_already_active';
  end if;

  update public.users
  set balance_cents = balance_cents - p_bet_cents
  where id = p_user_id
  returning * into v_user;

  insert into public.casino_rounds (
    user_id, game, bet_cents, status, state
  )
  values (
    p_user_id, p_game, p_bet_cents, 'active', coalesce(p_state, '{}'::jsonb)
  )
  returning * into v_round;

  insert into public.transactions (
    user_id, type, amount_cents, description, reference_id
  )
  values (
    p_user_id, 'casino_bet', -p_bet_cents, 'Mise casino',
    'casino-bet:' || v_round.id::text
  );

  return jsonb_build_object(
    'round_id', v_round.id,
    'version', v_round.version,
    'balance_cents', v_user.balance_cents
  );
end;
$$;

-- Met a jour l'etat d'une partie en cours (verification de version).
create or replace function public.casino_update_round(
  p_round_id uuid,
  p_user_id uuid,
  p_state jsonb,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.casino_rounds%rowtype;
begin
  update public.casino_rounds
  set state = coalesce(p_state, '{}'::jsonb),
      version = version + 1
  where id = p_round_id
    and user_id = p_user_id
    and status = 'active'
    and version = p_version
  returning * into v_round;

  if not found then
    raise exception 'round_conflict';
  end if;

  return jsonb_build_object(
    'round_id', v_round.id,
    'version', v_round.version
  );
end;
$$;

-- Double la mise (blackjack) : debit supplementaire controle.
create or replace function public.casino_raise_bet(
  p_round_id uuid,
  p_user_id uuid,
  p_extra_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.casino_rounds%rowtype;
  v_user public.users%rowtype;
begin
  if p_extra_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_round
  from public.casino_rounds
  where id = p_round_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'round_not_found';
  end if;

  if v_round.status <> 'active' then
    raise exception 'round_not_active';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if v_user.balance_cents < p_extra_cents then
    raise exception 'insufficient_balance';
  end if;

  update public.users
  set balance_cents = balance_cents - p_extra_cents
  where id = p_user_id
  returning * into v_user;

  update public.casino_rounds
  set bet_cents = bet_cents + p_extra_cents,
      version = version + 1
  where id = p_round_id
  returning * into v_round;

  insert into public.transactions (
    user_id, type, amount_cents, description, reference_id
  )
  values (
    p_user_id, 'casino_bet', -p_extra_cents, 'Double de mise',
    'casino-double:' || v_round.id::text
  );

  return jsonb_build_object(
    'round_id', v_round.id,
    'version', v_round.version,
    'bet_cents', v_round.bet_cents,
    'balance_cents', v_user.balance_cents
  );
end;
$$;

-- Termine une partie : credit du gain eventuel. Idempotent par statut + version.
create or replace function public.casino_finish_round(
  p_round_id uuid,
  p_user_id uuid,
  p_payout_cents bigint,
  p_status text,
  p_result jsonb,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.casino_rounds%rowtype;
  v_user public.users%rowtype;
begin
  if p_payout_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  if p_status not in ('won', 'lost', 'push') then
    raise exception 'invalid_status';
  end if;

  select * into v_round
  from public.casino_rounds
  where id = p_round_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'round_not_found';
  end if;

  if v_round.status <> 'active' then
    select * into v_user from public.users where id = v_round.user_id;
    return jsonb_build_object(
      'round_id', v_round.id,
      'status', v_round.status,
      'payout_cents', v_round.payout_cents,
      'balance_cents', v_user.balance_cents,
      'already_settled', true
    );
  end if;

  if v_round.version <> p_version then
    raise exception 'round_conflict';
  end if;

  update public.users
  set balance_cents = balance_cents + p_payout_cents
  where id = v_round.user_id
  returning * into v_user;

  update public.casino_rounds
  set status = p_status,
      payout_cents = p_payout_cents,
      result = coalesce(p_result, '{}'::jsonb),
      version = version + 1
  where id = p_round_id
  returning * into v_round;

  if p_payout_cents > 0 then
    insert into public.transactions (
      user_id, type, amount_cents, description, reference_id
    )
    values (
      v_round.user_id, 'casino_win', p_payout_cents, 'Gain casino',
      'casino-win:' || v_round.id::text
    );
  end if;

  return jsonb_build_object(
    'round_id', v_round.id,
    'status', v_round.status,
    'payout_cents', v_round.payout_cents,
    'balance_cents', v_user.balance_cents,
    'already_settled', false
  );
end;
$$;

-- Statistiques casino d'un utilisateur.
create or replace function public.casino_user_stats(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
begin
  select jsonb_build_object(
    'rounds', count(*),
    'wagered_cents', coalesce(sum(bet_cents), 0),
    'won_cents', coalesce(sum(payout_cents), 0),
    'net_cents', coalesce(sum(payout_cents - bet_cents), 0),
    'biggest_win_cents', coalesce(max(payout_cents), 0),
    'biggest_bet_cents', coalesce(max(bet_cents), 0)
  )
  into v_stats
  from public.casino_rounds
  where user_id = p_user_id
    and status <> 'active';

  return coalesce(v_stats, '{}'::jsonb);
end;
$$;

-- Securite casino.
alter table public.casino_rounds enable row level security;
revoke all on table public.casino_rounds from anon, authenticated;

revoke all on function public.casino_instant_bet(uuid, text, bigint, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.casino_start_round(uuid, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.casino_update_round(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.casino_raise_bet(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.casino_finish_round(uuid, uuid, bigint, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.casino_user_stats(uuid) from public, anon, authenticated;

grant execute on function public.casino_instant_bet(uuid, text, bigint, bigint, jsonb) to service_role;
grant execute on function public.casino_start_round(uuid, text, bigint, jsonb) to service_role;
grant execute on function public.casino_update_round(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.casino_raise_bet(uuid, uuid, bigint) to service_role;
grant execute on function public.casino_finish_round(uuid, uuid, bigint, text, jsonb, integer) to service_role;
grant execute on function public.casino_user_stats(uuid) to service_role;

-- ------------------------------------------------------------
-- NOTES
-- ------------------------------------------------------------
-- 1. Le solde ne peut etre modifie que par les fonctions ci-dessus.
-- 2. La service_role key ne doit jamais etre exposee au navigateur.
-- 3. Les montants sont stockes en centimes entiers.
-- 4. Les credits publicitaires sont idempotents (reference unique + statut).
-- 5. Les demandes de retrait reservent le montant ; un refus le rembourse.
-- 6. Le casino reserve la mise au demarrage, puis credite le gain a la fin.
-- 7. Les jeux a etats (blackjack, mines) utilisent un numero de version pour
--    empecher deux actions concurrentes sur la meme partie.
