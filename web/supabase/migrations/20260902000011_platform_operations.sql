-- KAEL platform operations: multi-tenant branding, review, finance, ordering,
-- booking, and HR. Every tenant-owned table carries business_id explicitly.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS public_name TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'id-ID',
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS pos_require_scheduled_shift BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_custom_domain
  ON public.businesses (LOWER(custom_domain)) WHERE custom_domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_brand_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL DEFAULT 'KAEL' CHECK (char_length(app_name) BETWEEN 2 AND 80),
  accent_color TEXT NOT NULL DEFAULT '#7958D8' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_email TEXT,
  public_footer_text TEXT,
  custom_domain_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (custom_domain_status IN ('not_requested', 'pending_dns', 'verified', 'rejected')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credentials deliberately live outside this database. secret_ref is the name
-- of a secret in the deployment vault, never a raw access token.
CREATE TABLE IF NOT EXISTS public.business_messaging_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (provider IN ('manual', 'meta_cloud', 'gateway')),
  sender_phone TEXT,
  phone_number_id TEXT,
  business_account_id TEXT,
  secret_ref TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 3 AND 100),
  entity_type TEXT NOT NULL CHECK (char_length(entity_type) BETWEEN 2 AND 80),
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_business_created ON public.audit_events (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.google_review_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  google_place_id TEXT NOT NULL,
  rating NUMERIC(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  review_count INT NOT NULL CHECK (review_count >= 0),
  source TEXT NOT NULL DEFAULT 'google_places' CHECK (source IN ('google_places', 'manual')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_review_snapshots_business_time ON public.google_review_snapshots (business_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.review_standee_configs (
  card_id UUID PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT 'Bantu kami dengan ulasan Google' CHECK (char_length(headline) BETWEEN 3 AND 120),
  body TEXT NOT NULL DEFAULT 'Scan QR atau tap kartu ini untuk memberi ulasan.',
  print_size TEXT NOT NULL DEFAULT 'A6' CHECK (print_size IN ('A6', 'A5', 'A4')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms_days INT NOT NULL DEFAULT 0 CHECK (payment_terms_days BETWEEN 0 AND 365),
  tax_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS public.supplier_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL CHECK (char_length(bill_no) BETWEEN 1 AND 80),
  issued_on DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on DATE,
  total_amount BIGINT NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'partial', 'paid', 'void')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, supplier_id, bill_no)
);

CREATE TABLE IF NOT EXISTS public.supplier_bill_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.supplier_bills(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('cash', 'transfer', 'qris', 'other')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_recipe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  qty_per_output NUMERIC NOT NULL CHECK (qty_per_output > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sale_recipe', 'sale_retail', 'adjustment', 'opname')),
  delta_qty NUMERIC NOT NULL CHECK (delta_qty <> 0),
  unit_cost BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reference_type TEXT,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_time ON public.inventory_movements (inventory_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  note TEXT,
  submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_opname_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opname_id UUID NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  system_qty NUMERIC NOT NULL,
  counted_qty NUMERIC NOT NULL CHECK (counted_qty >= 0),
  note TEXT,
  UNIQUE (opname_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.tax_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  code TEXT NOT NULL CHECK (char_length(code) BETWEEN 2 AND 30),
  rate_pct NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (rate_pct >= 0 AND rate_pct <= 100),
  tax_kind TEXT NOT NULL DEFAULT 'sales' CHECK (tax_kind IN ('sales', 'purchase', 'withholding', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, code)
);

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_qty_per_sale NUMERIC,
  ADD COLUMN IF NOT EXISTS unit_cost_override BIGINT;

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS tax_category_id UUID REFERENCES public.tax_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  ADD COLUMN IF NOT EXISTS account_code TEXT;

CREATE TABLE IF NOT EXISTS public.ordering_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_order BIGINT NOT NULL DEFAULT 0 CHECK (minimum_order >= 0),
  opens_at TIME,
  closes_at TIME,
  delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  postal_codes TEXT[] NOT NULL DEFAULT '{}',
  fee BIGINT NOT NULL DEFAULT 0 CHECK (fee >= 0),
  minimum_order BIGINT NOT NULL DEFAULT 0 CHECK (minimum_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
  deposit_amount BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_service_staff (
  service_id UUID NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
  PRIMARY KEY (service_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.booking_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  slot_interval_minutes INT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 240),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.booking_services(id) ON DELETE RESTRICT,
  staff_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  customer_phone TEXT NOT NULL CHECK (char_length(customer_phone) BETWEEN 8 AND 30),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending_deposit', 'confirmed', 'completed', 'cancelled', 'no_show')),
  deposit_amount BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  deposit_status TEXT NOT NULL DEFAULT 'not_required' CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded')),
  public_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  note TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_appointments_business_time ON public.appointments (business_id, starts_at);

CREATE TABLE IF NOT EXISTS public.booking_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  preferred_start TIMESTAMPTZ,
  preferred_end TIMESTAMPTZ,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'manual')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_work_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  role_label TEXT,
  pos_shift_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_business_time ON public.staff_work_schedules (business_id, starts_at);

CREATE TABLE IF NOT EXISTS public.attendance_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  allowed_radius_meters INT NOT NULL DEFAULT 150 CHECK (allowed_radius_meters BETWEEN 10 AND 5000),
  qr_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  nfc_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.staff_work_schedules(id) ON DELETE SET NULL,
  attendance_site_id UUID REFERENCES public.attendance_sites(id) ON DELETE SET NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_latitude NUMERIC(10,7),
  check_in_longitude NUMERIC(10,7),
  check_out_latitude NUMERIC(10,7),
  check_out_longitude NUMERIC(10,7),
  check_in_selfie_url TEXT,
  check_out_selfie_url TEXT,
  method TEXT NOT NULL DEFAULT 'self' CHECK (method IN ('self', 'qr', 'nfc', 'location')),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_business_user_time ON public.attendance_records (business_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('leave', 'sick', 'permission', 'overtime')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.payroll_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  base_pay BIGINT NOT NULL DEFAULT 0 CHECK (base_pay >= 0),
  overtime_pay BIGINT NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
  incentive_pay BIGINT NOT NULL DEFAULT 0 CHECK (incentive_pay >= 0),
  commission_pay BIGINT NOT NULL DEFAULT 0 CHECK (commission_pay >= 0),
  deduction BIGINT NOT NULL DEFAULT 0 CHECK (deduction >= 0),
  note TEXT,
  UNIQUE (payroll_period_id, user_id)
);

ALTER TABLE public.business_brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_messaging_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_standee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordering_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_service_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
