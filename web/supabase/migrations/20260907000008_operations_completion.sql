-- Close the operational gaps found in the sale-readiness audit.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS attendance_require_selfie BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS attendance_require_location BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_booking_waitlist_business_status
  ON public.booking_waitlist (business_id, status, preferred_start);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_due
  ON public.booking_reminders (scheduled_for, status)
  WHERE status = 'queued';
