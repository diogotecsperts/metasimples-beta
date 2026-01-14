-- Adicionar coluna para status verificado via contact_id
ALTER TABLE sendpulse_contacts 
ADD COLUMN IF NOT EXISTS status_id text DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN sendpulse_contacts.status_id IS 
'Status verificado via contact_id (ativo, bloqueado, nao_existe). NULL se não tem contact_id.';