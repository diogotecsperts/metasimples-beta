-- Habilitar realtime para as tabelas de log do WhatsApp
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_report_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_cobranca_log;