CREATE OR REPLACE FUNCTION public.export_auth_users_for_migration()
RETURNS TABLE (
  id uuid,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  has_password boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    u.id,
    u.instance_id,
    u.aud::text,
    u.role::text,
    u.email::text,
    u.encrypted_password,
    u.email_confirmed_at,
    u.raw_app_meta_data,
    u.raw_user_meta_data,
    u.created_at,
    u.updated_at,
    (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '') AS has_password
  FROM auth.users u
  ORDER BY u.created_at;
$$;

REVOKE ALL ON FUNCTION public.export_auth_users_for_migration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_auth_users_for_migration() TO postgres, service_role;