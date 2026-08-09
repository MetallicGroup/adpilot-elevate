SELECT cron.unschedule('adpilot-refresh-insights');
SELECT cron.schedule('adpilot-refresh-insights', '* * * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/refresh-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);