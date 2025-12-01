-- Criar tabela para configurações de relatórios automáticos
CREATE TABLE public.report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emails text[] NOT NULL DEFAULT '{}',
  horarios_ativos text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver configurações
CREATE POLICY "Admins podem ver configurações de relatórios"
ON public.report_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem criar configurações
CREATE POLICY "Admins podem criar configurações de relatórios"
ON public.report_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem atualizar configurações
CREATE POLICY "Admins podem atualizar configurações de relatórios"
ON public.report_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem deletar configurações
CREATE POLICY "Admins podem deletar configurações de relatórios"
ON public.report_settings
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_report_settings_updated_at
BEFORE UPDATE ON public.report_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();