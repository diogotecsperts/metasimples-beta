-- Remover todas as políticas antigas RESTRICTIVE da tabela lojas
DROP POLICY IF EXISTS "Apenas admin pode atualizar lojas" ON public.lojas;
DROP POLICY IF EXISTS "Apenas admin pode inserir lojas" ON public.lojas;
DROP POLICY IF EXISTS "Gerentes podem ver todas as lojas" ON public.lojas;

-- Remover políticas criadas anteriormente (se existirem)
DROP POLICY IF EXISTS "Admins podem gerenciar lojas" ON public.lojas;
DROP POLICY IF EXISTS "Gerentes podem visualizar lojas" ON public.lojas;

-- Criar políticas PERMISSIVE com verificação adequada de roles

-- Policy: Admins podem fazer SELECT em lojas
CREATE POLICY "Admins podem visualizar lojas"
ON public.lojas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins podem fazer INSERT em lojas
CREATE POLICY "Admins podem criar lojas"
ON public.lojas
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins podem fazer UPDATE em lojas
CREATE POLICY "Admins podem atualizar lojas"
ON public.lojas
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins podem fazer DELETE em lojas
CREATE POLICY "Admins podem deletar lojas"
ON public.lojas
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Gerentes podem visualizar lojas (apenas SELECT)
CREATE POLICY "Gerentes podem visualizar lojas"
ON public.lojas
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gerente'));