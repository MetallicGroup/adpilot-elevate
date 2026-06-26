-- Deduplicate any existing rows first, keeping the most recent
DELETE FROM public.performance_data a
USING public.performance_data b
WHERE a.campaign_id = b.campaign_id
  AND a.date = b.date
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS performance_data_campaign_date_uniq
  ON public.performance_data (campaign_id, date);