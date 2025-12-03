-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for Master user: can see ALL logs
CREATE POLICY "Master pode ver todos os logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Policy for regular Admins: can see logs EXCEPT those made by Master
CREATE POLICY "Admins podem ver logs exceto do master"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND auth.uid() != 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid
  AND user_id != 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid
);

-- Policy for INSERT: any authenticated user can insert logs
CREATE POLICY "Usuários autenticados podem criar logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);