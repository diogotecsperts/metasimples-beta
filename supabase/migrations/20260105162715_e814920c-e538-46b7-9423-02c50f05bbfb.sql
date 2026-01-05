-- Adicionar colunas de rastreabilidade completa aos logs de WhatsApp

-- Para whatsapp_report_log
ALTER TABLE whatsapp_report_log 
ADD COLUMN IF NOT EXISTS status_entrega TEXT DEFAULT 'aceito',
ADD COLUMN IF NOT EXISTS webhook_recebido_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_payload TEXT;

-- Para whatsapp_cobranca_log
ALTER TABLE whatsapp_cobranca_log 
ADD COLUMN IF NOT EXISTS status_entrega TEXT DEFAULT 'aceito',
ADD COLUMN IF NOT EXISTS webhook_recebido_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_payload TEXT;

-- Atualizar registros existentes para ter status_entrega baseado no sendpulse_status
UPDATE whatsapp_report_log 
SET status_entrega = CASE 
  WHEN sendpulse_status = 1 THEN 'aceito'
  WHEN status = 'erro' THEN 'falhou'
  ELSE 'aceito'
END
WHERE status_entrega IS NULL OR status_entrega = 'aceito';

UPDATE whatsapp_cobranca_log 
SET status_entrega = CASE 
  WHEN sendpulse_status = 1 THEN 'aceito'
  WHEN status = 'erro' THEN 'falhou'
  ELSE 'aceito'
END
WHERE status_entrega IS NULL OR status_entrega = 'aceito';