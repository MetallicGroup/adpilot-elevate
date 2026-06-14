REVOKE SELECT (access_token, token_expires_at) ON public.ad_accounts FROM authenticated, anon;
REVOKE SELECT (access_token, verify_token, activation_code) ON public.whatsapp_connections FROM authenticated, anon;
