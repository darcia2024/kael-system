-- Campaign dicatat sebelum WhatsApp dibuka. KAEL hanya merekam tindakan owner;
-- status terkirim tetap ditandai manual karena WhatsApp click-to-chat tidak
-- memberi bukti bahwa pesan benar-benar dikirim atau dibaca.
CREATE TABLE IF NOT EXISTS public.loyalty_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  segment TEXT NOT NULL CHECK (segment IN ('new', 'active', 'at_risk', 'inactive')),
  message_template TEXT NOT NULL CHECK (char_length(message_template) BETWEEN 1 AND 2000),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.loyalty_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'sent', 'skipped')),
  opened_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loyalty_campaign_recipient UNIQUE (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_business_created
  ON public.loyalty_campaigns (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaign_recipients_campaign_status
  ON public.loyalty_campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaign_recipients_customer
  ON public.loyalty_campaign_recipients (customer_id);

ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can manage loyalty campaigns"
ON public.loyalty_campaigns FOR ALL
USING (business_id = public.get_auth_business_id() AND public.get_auth_user_role() = 'owner');

CREATE POLICY "Business owner can manage campaign recipients"
ON public.loyalty_campaign_recipients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.loyalty_campaigns c
    WHERE c.id = loyalty_campaign_recipients.campaign_id
      AND c.business_id = public.get_auth_business_id()
      AND public.get_auth_user_role() = 'owner'
  )
);
