-- One NFC card can present several tenant-controlled customer actions.
CREATE TABLE IF NOT EXISTS public.smart_touch_profiles (
  card_id UUID PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  subtitle TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_touch_buttons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL CHECK (action_key IN ('review', 'whatsapp', 'menu', 'member', 'location', 'booking', 'custom')),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 50),
  target_url TEXT NOT NULL CHECK (target_url ~ '^https://'),
  sort_order INT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (card_id, action_key)
);
CREATE INDEX IF NOT EXISTS idx_smart_touch_buttons_card ON public.smart_touch_buttons (card_id, sort_order);
ALTER TABLE public.smart_touch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_touch_buttons ENABLE ROW LEVEL SECURITY;
