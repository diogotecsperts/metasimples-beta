-- Tabela para armazenar ajustes manuais de metas diárias
CREATE TABLE public.metas_diarias_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_mensal_id UUID NOT NULL REFERENCES public.metas_mensais(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  meta_original NUMERIC NOT NULL,
  meta_ajustada NUMERIC NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(meta_mensal_id, data)
);

-- Habilitar RLS
ALTER TABLE public.metas_diarias_ajustes ENABLE ROW LEVEL SECURITY;

-- Admins podem fazer tudo
CREATE POLICY "Admins podem gerenciar ajustes de metas"
ON public.metas_diarias_ajustes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gerentes podem ver ajustes da sua loja
CREATE POLICY "Gerentes podem ver ajustes da sua loja"
ON public.metas_diarias_ajustes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.loja_id = metas_diarias_ajustes.loja_id
  )
);

-- Índice para busca rápida por meta_mensal_id
CREATE INDEX idx_metas_diarias_ajustes_meta_mensal ON public.metas_diarias_ajustes(meta_mensal_id);

-- Índice para busca por loja e data
CREATE INDEX idx_metas_diarias_ajustes_loja_data ON public.metas_diarias_ajustes(loja_id, data);