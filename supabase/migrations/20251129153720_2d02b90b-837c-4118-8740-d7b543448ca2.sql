-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username text UNIQUE;

-- Create index for better performance on username lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.username IS 'Username for simplified login (alternative to email)';