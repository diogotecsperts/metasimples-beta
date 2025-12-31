-- Tabela de configurações do sistema de cobrança WhatsApp
CREATE TABLE public.whatsapp_cobranca_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT false,
  tolerancia_minutos INTEGER NOT NULL DEFAULT 5,
  intervalos_cobranca TEXT[] NOT NULL DEFAULT ARRAY['05', '15', '30'],
  gerentes_ativos UUID[] NOT NULL DEFAULT '{}',
  horarios_monitorados TEXT[] NOT NULL DEFAULT ARRAY['10:00', '14:00', '16:00', '19:00'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_cobranca_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Master Admin apenas
CREATE POLICY "Master pode ver whatsapp cobranca settings"
ON public.whatsapp_cobranca_settings
FOR SELECT
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode criar whatsapp cobranca settings"
ON public.whatsapp_cobranca_settings
FOR INSERT
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode atualizar whatsapp cobranca settings"
ON public.whatsapp_cobranca_settings
FOR UPDATE
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid)
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode deletar whatsapp cobranca settings"
ON public.whatsapp_cobranca_settings
FOR DELETE
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_cobranca_settings_updated_at
BEFORE UPDATE ON public.whatsapp_cobranca_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de log de cobranças enviadas
CREATE TABLE public.whatsapp_cobranca_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gerente_id UUID NOT NULL,
  loja_id UUID NOT NULL,
  data DATE NOT NULL,
  horario_lancamento TEXT NOT NULL,
  minutos_atraso INTEGER NOT NULL,
  nivel_cobranca INTEGER NOT NULL,
  template_usado TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enviado',
  erro_detalhes TEXT
);

-- Enable RLS
ALTER TABLE public.whatsapp_cobranca_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Master Admin apenas
CREATE POLICY "Master pode ver whatsapp cobranca log"
ON public.whatsapp_cobranca_log
FOR SELECT
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode criar whatsapp cobranca log"
ON public.whatsapp_cobranca_log
FOR INSERT
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Índices para performance
CREATE INDEX idx_whatsapp_cobranca_log_gerente_data ON public.whatsapp_cobranca_log(gerente_id, data);
CREATE INDEX idx_whatsapp_cobranca_log_data_horario ON public.whatsapp_cobranca_log(data, horario_lancamento);