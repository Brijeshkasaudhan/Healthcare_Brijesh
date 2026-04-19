
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New research chat',
  patient_name TEXT,
  disease TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_session ON public.conversations(session_id, updated_at DESC);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  structured_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Anonymous session-based app: edge functions use service role and enforce session_id ownership.
-- Deny all direct client access.
CREATE POLICY "no direct access conversations" ON public.conversations FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "no direct access messages" ON public.messages FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
