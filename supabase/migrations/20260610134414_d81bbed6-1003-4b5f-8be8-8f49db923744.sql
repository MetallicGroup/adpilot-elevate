-- Restrict client access to sensitive OAuth token columns on ad_accounts.
-- Only service_role (server-side) may read or write access_token / token_expires_at.
REVOKE SELECT (access_token, token_expires_at), INSERT (access_token, token_expires_at), UPDATE (access_token, token_expires_at) ON public.ad_accounts FROM authenticated, anon;

GRANT SELECT, INSERT, UPDATE (advertiser_id, advertiser_name, is_active) ON public.ad_accounts TO authenticated;