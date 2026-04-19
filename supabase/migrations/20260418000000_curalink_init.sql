-- Curalink core tables
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  title text not null default 'New conversation',
  patient_name text,
  disease text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_session_id_idx on public.conversations(session_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages(conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- v1: no auth. RLS is fully closed; all access goes through edge functions
-- which use the service role key. This prevents cross-session data leaks.
-- (When auth is added later, replace with auth.uid()-based policies.)

create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end; $$;

create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_updated_at();
