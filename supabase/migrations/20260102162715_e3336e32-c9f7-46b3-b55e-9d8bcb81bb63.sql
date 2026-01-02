-- Criar tabela de log de envios de relatórios WhatsApp
CREATE TABLE public.whatsapp_report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_nome TEXT NOT NULL,
  admin_telefone TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horario_envio TEXT NOT NULL,
  template_usado TEXT NOT NULL DEFAULT 'relatorio_diario_v2',
  is_test BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro_detalhes TEXT,
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_report_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Master pode ver whatsapp report log"
  ON public.whatsapp_report_log FOR SELECT
  USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

CREATE POLICY "Master pode inserir whatsapp report log"
  ON public.whatsapp_report_log FOR INSERT
  WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Índices para consultas eficientes
CREATE INDEX idx_whatsapp_report_log_data ON public.whatsapp_report_log(data);
CREATE INDEX idx_whatsapp_report_log_admin ON public.whatsapp_report_log(admin_id);
CREATE INDEX idx_whatsapp_report_log_enviado_em ON public.whatsapp_report_log(enviado_em DESC);