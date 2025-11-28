-- Adicionar policies RLS para admins gerenciarem metas mensais

-- Policy: admins podem ver todas as metas
CREATE POLICY "Admins podem ver todas as metas"
ON public.metas_mensais
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: admins podem criar metas
CREATE POLICY "Admins podem criar metas"
ON public.metas_mensais
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: admins podem atualizar metas
CREATE POLICY "Admins podem atualizar metas"
ON public.metas_mensais
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: admins podem deletar metas
CREATE POLICY "Admins podem deletar metas"
ON public.metas_mensais
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));