ALTER TABLE public.booking_campaigns
  ADD COLUMN IF NOT EXISTS objective text NOT NULL DEFAULT 'bookings';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_campaigns_objective_check'
  ) THEN
    ALTER TABLE public.booking_campaigns
      ADD CONSTRAINT booking_campaigns_objective_check
      CHECK (objective IN ('sales','bookings','leads','calls'));
  END IF;
END $$;

ALTER TABLE public.booking_campaigns
  ADD COLUMN IF NOT EXISTS call_phone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_goal text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_onboarding_goal_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_onboarding_goal_check
      CHECK (onboarding_goal IS NULL OR onboarding_goal IN ('sales','bookings','leads','calls'));
  END IF;
END $$;