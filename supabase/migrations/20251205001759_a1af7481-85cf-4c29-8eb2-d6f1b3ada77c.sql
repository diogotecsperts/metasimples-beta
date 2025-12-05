-- Adicionar RLS policy para admins criarem lançamentos
CREATE POLICY "Admins podem criar lançamentos"
ON lancamentos_diarios FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));