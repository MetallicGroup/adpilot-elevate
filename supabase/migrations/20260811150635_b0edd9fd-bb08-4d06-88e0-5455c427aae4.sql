-- =====================  BUSINESS PROFILES  =====================
CREATE TABLE public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  niche text NOT NULL DEFAULT 'general',
  niche_custom text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  brand_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  timezone text NOT NULL DEFAULT 'Europe/Bucharest',
  privacy_policy_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own business profile" ON public.business_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_business_profiles_updated BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================  BOOKING CAMPAIGNS  =====================
CREATE TABLE public.booking_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  service text NOT NULL,
  offer text,
  status text NOT NULL DEFAULT 'draft',
  landing_copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  hero_image_url text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  pixel_id text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_campaigns_user ON public.booking_campaigns(user_id);
CREATE INDEX idx_booking_campaigns_business ON public.booking_campaigns(business_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_campaigns TO authenticated;
GRANT SELECT ON public.booking_campaigns TO anon;
GRANT ALL ON public.booking_campaigns TO service_role;
ALTER TABLE public.booking_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own booking campaigns" ON public.booking_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public reads published booking campaigns" ON public.booking_campaigns
  FOR SELECT TO anon USING (status = 'published');
CREATE TRIGGER trg_booking_campaigns_updated BEFORE UPDATE ON public.booking_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is a booking campaign published?
CREATE OR REPLACE FUNCTION public.booking_campaign_is_published(_bc_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.booking_campaigns WHERE id = _bc_id AND status = 'published')
$$;
REVOKE EXECUTE ON FUNCTION public.booking_campaign_is_published(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_campaign_is_published(uuid) TO anon, authenticated, service_role;

-- =====================  QUESTIONS  =====================
CREATE TABLE public.booking_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_campaign_id uuid NOT NULL REFERENCES public.booking_campaigns(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT true,
  help_text text,
  source text NOT NULL DEFAULT 'ai',
  scoring_weight jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_questions_type_chk CHECK (type IN ('text','textarea','single_select','multi_select','yes_no','number','date')),
  CONSTRAINT booking_questions_source_chk CHECK (source IN ('preset','ai','user')),
  UNIQUE (booking_campaign_id, key)
);
CREATE INDEX idx_booking_questions_bc ON public.booking_questions(booking_campaign_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_questions TO authenticated;
GRANT SELECT ON public.booking_questions TO anon;
GRANT ALL ON public.booking_questions TO service_role;
ALTER TABLE public.booking_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own booking questions" ON public.booking_questions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public reads questions of published pages" ON public.booking_questions
  FOR SELECT TO anon USING (public.booking_campaign_is_published(booking_campaign_id));
CREATE TRIGGER trg_booking_questions_updated BEFORE UPDATE ON public.booking_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================  SERVICES  =====================
CREATE TABLE public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_campaign_id uuid NOT NULL REFERENCES public.booking_campaigns(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  duration_min integer NOT NULL DEFAULT 60,
  price numeric,
  currency text NOT NULL DEFAULT 'RON',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_services_bc ON public.booking_services(booking_campaign_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_services TO authenticated;
GRANT SELECT ON public.booking_services TO anon;
GRANT ALL ON public.booking_services TO service_role;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own booking services" ON public.booking_services
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public reads services of published pages" ON public.booking_services
  FOR SELECT TO anon USING (public.booking_campaign_is_published(booking_campaign_id));
CREATE TRIGGER trg_booking_services_updated BEFORE UPDATE ON public.booking_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================  AVAILABILITY  =====================
CREATE TABLE public.booking_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  slot_min integer NOT NULL DEFAULT 30,
  buffer_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_availability_weekday_chk CHECK (weekday BETWEEN 0 AND 6),
  UNIQUE (business_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_availability TO authenticated;
GRANT SELECT ON public.booking_availability TO anon;
GRANT ALL ON public.booking_availability TO service_role;
ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own availability" ON public.booking_availability
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public reads availability of businesses with published pages" ON public.booking_availability
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.booking_campaigns bc WHERE bc.business_id = booking_availability.business_id AND bc.status = 'published')
  );
CREATE TRIGGER trg_booking_availability_updated BEFORE UPDATE ON public.booking_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.booking_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_blackouts_business ON public.booking_blackouts(business_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_blackouts TO authenticated;
GRANT SELECT ON public.booking_blackouts TO anon;
GRANT ALL ON public.booking_blackouts TO service_role;
ALTER TABLE public.booking_blackouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own blackouts" ON public.booking_blackouts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public reads blackouts of businesses with published pages" ON public.booking_blackouts
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.booking_campaigns bc WHERE bc.business_id = booking_blackouts.business_id AND bc.status = 'published')
  );

-- =====================  BOOKINGS  =====================
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  booking_campaign_id uuid NOT NULL REFERENCES public.booking_campaigns(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE SET NULL,
  service_name text,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  qualification_score integer,
  qualification_tier text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  revenue numeric,
  notes text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  capi_sent_at timestamptz,
  capi_event_id text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_status_chk CHECK (status IN ('pending','confirmed','attended','no_show','cancelled','won','lost')),
  CONSTRAINT bookings_tier_chk CHECK (qualification_tier IS NULL OR qualification_tier IN ('hot','warm','cold'))
);
CREATE INDEX idx_bookings_user_created ON public.bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_bc ON public.bookings(booking_campaign_id, slot_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own bookings" ON public.bookings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================  PAGE VIEWS  =====================
CREATE TABLE public.booking_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_campaign_id uuid NOT NULL REFERENCES public.booking_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_page_views_bc ON public.booking_page_views(booking_campaign_id, created_at DESC);
GRANT SELECT ON public.booking_page_views TO authenticated;
GRANT ALL ON public.booking_page_views TO service_role;
ALTER TABLE public.booking_page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own page views" ON public.booking_page_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================  EXTENSIONS ON EXISTING TABLES  =====================
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'lead_form',
  ADD COLUMN IF NOT EXISTS booking_campaign_id uuid REFERENCES public.booking_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pixel_id text;

ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS pixel_id text;

ALTER TABLE public.performance_data
  ADD COLUMN IF NOT EXISTS bookings integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_bookings integer NOT NULL DEFAULT 0;