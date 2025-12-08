-- Tabela para itens do changelog
CREATE TABLE public.changelog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('disponivel', 'desenvolvimento', 'indeterminado')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabela para rastrear última leitura do changelog por usuário (para badge)
CREATE TABLE public.changelog_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.changelog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_read_status ENABLE ROW LEVEL SECURITY;

-- Políticas para changelog_items
-- Master pode fazer tudo
CREATE POLICY "Master pode gerenciar changelog"
ON public.changelog_items
FOR ALL
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Admins podem ver itens publicados
CREATE POLICY "Admins podem ver changelog publicado"
ON public.changelog_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND published_at IS NOT NULL 
  AND published_at <= now()
);

-- Políticas para changelog_read_status
-- Usuários podem ver/atualizar seu próprio status
CREATE POLICY "Usuários podem ver seu status de leitura"
ON public.changelog_read_status
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu status de leitura"
ON public.changelog_read_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu status de leitura"
ON public.changelog_read_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_changelog_items_updated_at
BEFORE UPDATE ON public.changelog_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();