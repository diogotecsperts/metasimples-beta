-- Tabela para gerenciar contatos do SendPulse dinamicamente
CREATE TABLE public.sendpulse_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('gerente', 'admin')),
  telefone TEXT NOT NULL,
  sendpulse_contact_id TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'bloqueado', 'nao_existe')),
  opt_in_at TIMESTAMPTZ,
  ultimo_bloqueio_at TIMESTAMPTZ,
  ultimo_envio_sucesso_at TIMESTAMPTZ,
  tentativas_envio INTEGER DEFAULT 0,
  tentativas_falha_consecutivas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(telefone)
);

-- Índices para performance
CREATE INDEX idx_sendpulse_contacts_user_id ON public.sendpulse_contacts(user_id);
CREATE INDEX idx_sendpulse_contacts_telefone ON public.sendpulse_contacts(telefone);
CREATE INDEX idx_sendpulse_contacts_status ON public.sendpulse_contacts(status);

-- Habilitar RLS
ALTER TABLE public.sendpulse_contacts ENABLE ROW LEVEL SECURITY;

-- Master pode gerenciar tudo
CREATE POLICY "Master pode gerenciar contatos sendpulse" 
ON public.sendpulse_contacts 
FOR ALL 
USING (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099')
WITH CHECK (auth.uid() = 'ca936b16-8a15-43f4-976d-6be91e294099');

-- Admins podem visualizar contatos
CREATE POLICY "Admins podem ver contatos sendpulse" 
ON public.sendpulse_contacts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sendpulse_contacts_updated_at
BEFORE UPDATE ON public.sendpulse_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.sendpulse_contacts;

-- Inserir dados migrados do KNOWN_CONTACTS (gerentes)
-- Lais
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587981244339', '695549a0143b1c873907e63a', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87981244339%' OR p.nome ILIKE '%lais%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Evandro
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587999443311', '695549a0143b1c873907e63b', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87999443311%' OR p.nome ILIKE '%evandro%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Raiane
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5581984415469', '695549a0143b1c873907e63c', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%81984415469%' OR p.nome ILIKE '%raiane%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Murilo
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5581985538572', '695549a0143b1c873907e63d', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%81985538572%' OR p.nome ILIKE '%murilo%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Alice
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587991364316', '695549a0143b1c873907e63e', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87991364316%' OR p.nome ILIKE '%alice%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Caio
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587981578652', '695549a0143b1c873907e63f', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87981578652%' OR p.nome ILIKE '%caio%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Tiago
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587996274416', '695549a0143b1c873907e640', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87996274416%' OR p.nome ILIKE '%tiago%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Cida
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587988166174', '695549a0143b1c873907e641', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87988166174%' OR p.nome ILIKE '%cida%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Poliana
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587988084422', '695549a0143b1c873907e642', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87988084422%' OR p.nome ILIKE '%poliana%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Rosy
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5587988326545', '695549a0143b1c873907e643', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%87988326545%' OR p.nome ILIKE '%rosy%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Matheus
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
SELECT p.id, 'gerente', '+5581996855926', '695549a0143b1c873907e639', 'ativo'
FROM public.profiles p WHERE p.telefone LIKE '%81996855926%' OR p.nome ILIKE '%matheus%'
LIMIT 1
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status;

-- Inserir admins (estes existem com certeza)
-- Diogo DEV
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
VALUES ('ca936b16-8a15-43f4-976d-6be91e294099', 'admin', '+5582981627838', '69322fead2b7eee6000b2336', 'ativo')
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status, user_type = EXCLUDED.user_type;

-- Thiago
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
VALUES ('766164b8-23c5-490a-8409-412e8651da33', 'admin', '+5587981757169', '69370bb93debac0d790a7a42', 'ativo')
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status, user_type = EXCLUDED.user_type;

-- Dyogo
INSERT INTO public.sendpulse_contacts (user_id, user_type, telefone, sendpulse_contact_id, status)
VALUES ('687d830b-4bad-4e39-9273-fab71f0d4bd0', 'admin', '+5581982882100', '69556ee0143b1c873907e644', 'ativo')
ON CONFLICT (telefone) DO UPDATE SET sendpulse_contact_id = EXCLUDED.sendpulse_contact_id, status = EXCLUDED.status, user_type = EXCLUDED.user_type;