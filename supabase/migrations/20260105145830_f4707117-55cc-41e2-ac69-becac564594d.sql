-- Adicionar colunas de rastreabilidade na tabela whatsapp_report_log
ALTER TABLE whatsapp_report_log 
ADD COLUMN IF NOT EXISTS sendpulse_response TEXT,
ADD COLUMN IF NOT EXISTS sendpulse_message_id TEXT,
ADD COLUMN IF NOT EXISTS sendpulse_status INTEGER;

-- Adicionar colunas de rastreabilidade na tabela whatsapp_cobranca_log
ALTER TABLE whatsapp_cobranca_log 
ADD COLUMN IF NOT EXISTS sendpulse_response TEXT,
ADD COLUMN IF NOT EXISTS sendpulse_message_id TEXT,
ADD COLUMN IF NOT EXISTS sendpulse_status INTEGER;