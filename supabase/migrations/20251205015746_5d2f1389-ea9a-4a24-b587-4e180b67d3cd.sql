-- Criar tabela de configurações de relatórios WhatsApp
CREATE TABLE public.whatsapp_report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo BOOLEAN NOT NULL DEFAULT false,
  horarios_ativos TEXT[] NOT NULL DEFAULT '{}',
  gerentes_ativos UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_report_settings ENABLE ROW LEVEL SECURITY;

-- Apenas Master Admin pode gerenciar configurações de WhatsApp
CREATE POLICY "Master pode ver whatsapp settings"
ON public.whatsapp_report_settings
FOR SELECT
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode criar whatsapp settings"
ON public.whatsapp_report_settings
FOR INSERT
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode atualizar whatsapp settings"
ON public.whatsapp_report_settings
FOR UPDATE
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid)
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode deletar whatsapp settings"
ON public.whatsapp_report_settings
FOR DELETE
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_report_settings_updated_at
BEFORE UPDATE ON public.whatsapp_report_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();