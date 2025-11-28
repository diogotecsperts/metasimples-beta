-- Habilitar realtime para a tabela lancamentos_diarios
ALTER TABLE public.lancamentos_diarios REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lancamentos_diarios;