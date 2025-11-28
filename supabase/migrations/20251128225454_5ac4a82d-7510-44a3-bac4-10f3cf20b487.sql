-- Adicionar policies de admin para lancamentos_diarios
-- Permitir que admins visualizem todos os lançamentos (auditoria)
CREATE POLICY "Admins podem visualizar todos os lançamentos"
ON public.lancamentos_diarios
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Permitir que admins atualizem lançamentos (correções administrativas)
CREATE POLICY "Admins podem atualizar lançamentos"
ON public.lancamentos_diarios
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Permitir que admins deletem lançamentos (correções administrativas)
CREATE POLICY "Admins podem deletar lançamentos"
ON public.lancamentos_diarios
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));