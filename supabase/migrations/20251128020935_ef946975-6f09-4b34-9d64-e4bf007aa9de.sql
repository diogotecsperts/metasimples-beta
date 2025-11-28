-- Adicionar policies RLS para admins gerenciarem profiles

-- Policy: admins podem ver todos os profiles
CREATE POLICY "Admins podem ver todos os profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: admins podem atualizar todos os profiles
CREATE POLICY "Admins podem atualizar todos os profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: admins podem deletar profiles (para remover gerentes)
CREATE POLICY "Admins podem deletar profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));