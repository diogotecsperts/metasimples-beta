-- Adicionar colunas de confirmação manual na tabela whatsapp_report_log
ALTER TABLE public.whatsapp_report_log 
ADD COLUMN IF NOT EXISTS confirmacao_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmado_manual_em TIMESTAMPTZ;

-- Adicionar colunas de confirmação manual na tabela whatsapp_cobranca_log
ALTER TABLE public.whatsapp_cobranca_log 
ADD COLUMN IF NOT EXISTS confirmacao_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmado_manual_em TIMESTAMPTZ;

-- Criar políticas de UPDATE para permitir atualização do status manual (report_log)
CREATE POLICY "Master pode atualizar whatsapp report log" 
ON public.whatsapp_report_log 
FOR UPDATE 
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid)
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);

-- Criar políticas de UPDATE para permitir atualização do status manual (cobranca_log)
CREATE POLICY "Master pode atualizar whatsapp cobranca log" 
ON public.whatsapp_cobranca_log 
FOR UPDATE 
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid)
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099'::uuid);