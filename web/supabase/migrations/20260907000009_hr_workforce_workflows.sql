-- Owner approval, payroll, and attendance reports all filter by these paths.
CREATE INDEX IF NOT EXISTS idx_leave_requests_business_status_time
  ON public.leave_requests (business_id, status, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_period_user
  ON public.payroll_lines (payroll_period_id, user_id);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_business_user_range
  ON public.staff_work_schedules (business_id, user_id, starts_at, ends_at)
  WHERE status = 'scheduled';
