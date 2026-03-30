create table if not exists accounts (
  id uuid primary key,
  email text not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  activation_code_hash text,
  sync_token_hash text,
  license_status text not null default 'free',
  license_plan text,
  stripe_checkout_session_id text,
  stripe_price_id text,
  stripe_subscription_status text,
  current_period_end timestamptz,
  expires_at timestamptz,
  synced_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists processed_webhooks (
  id text primary key,
  received_at timestamptz not null default now()
);
