-- Criar enum para tipo operacional
CREATE TYPE public.tipo_operacional AS ENUM ('A', 'B');

-- Criar enum para horários de lançamento
CREATE TYPE public.horario_lancamento AS ENUM ('10:00', '14:00', '16:00', '19:00', '23:00');

-- Tabela de lojas
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_operacional tipo_operacional NOT NULL DEFAULT 'B',
  possui_fechamento_tardio BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- Policies para lojas (todos gerentes autenticados podem ver todas as lojas)
CREATE POLICY "Gerentes podem ver todas as lojas"
  ON public.lojas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas admin pode inserir lojas"
  ON public.lojas FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Será ajustado quando implementarmos roles

CREATE POLICY "Apenas admin pode atualizar lojas"
  ON public.lojas FOR UPDATE
  TO authenticated
  USING (false);

-- Tabela de profiles (gerentes)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger para criar profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', new.email)
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Tabela de metas mensais
CREATE TABLE public.metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020),
  meta_mensal DECIMAL(12, 2) NOT NULL CHECK (meta_mensal >= 0),
  meta_diaria_calculada DECIMAL(12, 2) NOT NULL CHECK (meta_diaria_calculada >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(loja_id, mes, ano)
);

ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

-- Policies para metas mensais
CREATE POLICY "Gerentes podem ver metas de sua loja"
  ON public.metas_mensais FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = metas_mensais.loja_id
    )
  );

CREATE POLICY "Gerentes podem criar metas de sua loja"
  ON public.metas_mensais FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = metas_mensais.loja_id
    )
  );

CREATE POLICY "Gerentes podem atualizar metas de sua loja"
  ON public.metas_mensais FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = metas_mensais.loja_id
    )
  );

-- Tabela de lançamentos diários
CREATE TABLE public.lancamentos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario horario_lancamento,
  valor_acumulado DECIMAL(12, 2) NOT NULL CHECK (valor_acumulado >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(loja_id, data, horario)
);

ALTER TABLE public.lancamentos_diarios ENABLE ROW LEVEL SECURITY;

-- Policies para lançamentos diários
CREATE POLICY "Gerentes podem ver lançamentos de sua loja"
  ON public.lancamentos_diarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = lancamentos_diarios.loja_id
    )
  );

CREATE POLICY "Gerentes podem criar lançamentos de sua loja"
  ON public.lancamentos_diarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = lancamentos_diarios.loja_id
    )
  );

CREATE POLICY "Gerentes podem atualizar lançamentos de sua loja"
  ON public.lancamentos_diarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.loja_id = lancamentos_diarios.loja_id
    )
  );

-- Trigger para atualizar updated_at em metas_mensais
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_metas_mensais_updated_at
  BEFORE UPDATE ON public.metas_mensais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lancamentos_diarios_updated_at
  BEFORE UPDATE ON public.lancamentos_diarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_profiles_loja_id ON public.profiles(loja_id);
CREATE INDEX idx_metas_mensais_loja_id ON public.metas_mensais(loja_id);
CREATE INDEX idx_metas_mensais_mes_ano ON public.metas_mensais(mes, ano);
CREATE INDEX idx_lancamentos_diarios_loja_id ON public.lancamentos_diarios(loja_id);
CREATE INDEX idx_lancamentos_diarios_data ON public.lancamentos_diarios(data);
CREATE INDEX idx_lancamentos_diarios_loja_data ON public.lancamentos_diarios(loja_id, data);