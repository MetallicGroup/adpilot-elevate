DROP POLICY "Public reads questions of published pages" ON public.booking_questions;
DROP POLICY "Public reads services of published pages" ON public.booking_services;
DROP FUNCTION public.booking_campaign_is_published(uuid);

CREATE POLICY "Public reads questions of published pages" ON public.booking_questions
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.booking_campaigns bc
      WHERE bc.id = booking_questions.booking_campaign_id AND bc.status = 'published'
    )
  );

CREATE POLICY "Public reads services of published pages" ON public.booking_services
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.booking_campaigns bc
      WHERE bc.id = booking_services.booking_campaign_id AND bc.status = 'published'
    )
  );