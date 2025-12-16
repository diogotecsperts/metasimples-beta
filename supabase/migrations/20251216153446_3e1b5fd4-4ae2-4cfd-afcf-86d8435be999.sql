-- Adicionar colunas para modo manual de relatórios
ALTER TABLE public.report_settings 
ADD COLUMN IF NOT EXISTS modo TEXT DEFAULT 'automatico' CHECK (modo IN ('automatico', 'manual'));

ALTER TABLE public.report_settings 
ADD COLUMN IF NOT EXISTS horarios_manuais TEXT[] DEFAULT '{}';