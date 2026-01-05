-- Adicionar campos para registrar método de envio em whatsapp_report_log
ALTER TABLE whatsapp_report_log 
ADD COLUMN metodo_envio TEXT DEFAULT 'phone',
ADD COLUMN contact_id_usado TEXT;

-- Adicionar campos para registrar método de envio em whatsapp_cobranca_log
ALTER TABLE whatsapp_cobranca_log 
ADD COLUMN metodo_envio TEXT DEFAULT 'phone',
ADD COLUMN contact_id_usado TEXT,
ADD COLUMN telefone_usado TEXT;