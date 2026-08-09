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

SELECT cron.unschedule('adpilot-periodic-update');
SELECT cron.schedule('adpilot-periodic-update', '*/30 * * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/periodic-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('adpilot-anomaly-scan');
SELECT cron.schedule('adpilot-anomaly-scan', '15 * * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/anomaly-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('adpilot-wa-keepalive');
SELECT cron.schedule('adpilot-wa-keepalive', '30 * * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/wa-keepalive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('adpilot-daily-report');
SELECT cron.schedule('adpilot-daily-report', '0 6 * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('adpilot-sync-meta-leads');
SELECT cron.schedule('adpilot-sync-meta-leads', '*/3 * * * *', $$
SELECT net.http_post(
    url := 'https://project--5785506e-f54a-4fa0-9cd0-b98a0a8bf624.lovable.app/api/public/hooks/sync-meta-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);