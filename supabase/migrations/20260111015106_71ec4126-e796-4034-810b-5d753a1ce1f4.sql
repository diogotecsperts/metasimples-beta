-- Criar tabela para configurações de alertas de auditoria
CREATE TABLE public.audit_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo BOOLEAN NOT NULL DEFAULT false,
  emails TEXT[] NOT NULL DEFAULT '{}',
  acoes_monitoradas TEXT[] NOT NULL DEFAULT ARRAY['delete'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audit_alert_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler configurações de alerta
CREATE POLICY "Admins podem ler configuracoes de alerta"
  ON public.audit_alert_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Apenas admins podem criar/atualizar/deletar configurações
CREATE POLICY "Admins podem gerenciar configuracoes de alerta"
  ON public.audit_alert_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir configuração padrão (desativada)
INSERT INTO public.audit_alert_settings (ativo, emails, acoes_monitoradas)
VALUES (false, '{}', ARRAY['delete']);