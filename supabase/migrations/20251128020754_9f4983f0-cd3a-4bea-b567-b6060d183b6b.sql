-- Criar enum para roles da aplicação
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente');

-- Criar tabela de roles de usuários (segurança: roles em tabela separada)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar roles (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: usuários podem ver seus próprios roles
CREATE POLICY "Usuários podem ver seus próprios roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: apenas admins podem gerenciar roles
CREATE POLICY "Admins podem gerenciar todos os roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Atualizar policies da tabela lojas para usar has_role

-- Remover policies antigas
DROP POLICY IF EXISTS "Apenas admin pode inserir lojas" ON public.lojas;
DROP POLICY IF EXISTS "Apenas admin pode atualizar lojas" ON public.lojas;
DROP POLICY IF EXISTS "Gerentes podem ver todas as lojas" ON public.lojas;

-- Policy: admins podem fazer tudo com lojas
CREATE POLICY "Admins podem gerenciar lojas"
ON public.lojas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: gerentes podem apenas visualizar lojas
CREATE POLICY "Gerentes podem visualizar lojas"
ON public.lojas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gerente'));

-- Comentário importante para desenvolvimento:
-- Para criar um usuário admin durante desenvolvimento, após autenticação:
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('uuid-do-usuario-autenticado', 'admin');