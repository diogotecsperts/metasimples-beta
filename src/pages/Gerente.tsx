import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MetaDiariaHeader } from "@/components/gerente/MetaDiariaHeader";
import { TimelineSlot } from "@/components/gerente/TimelineSlot";
import { LancamentoDialog } from "@/components/gerente/LancamentoDialog";
import { format } from "date-fns";

type Loja = {
  id: string;
  nome: string;
  possui_fechamento_tardio: boolean;
};

type MetaMensal = {
  id: string;
  meta_diaria_calculada: number;
};

type Lancamento = {
  id: string;
  horario: string;
  valor_acumulado: number;
};

const HORARIOS_BASE = ["10:00", "14:00", "16:00", "19:00"];
const HORARIO_TARDIO = "23:00";

const Gerente = () => {
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);
  const [gerenteLojaId, setGerenteLojaId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  // Buscar perfil do gerente
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("loja_id")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erro ao buscar perfil:", error);
        return;
      }

      setGerenteLojaId(data?.loja_id || null);
    };

    fetchProfile();
  }, []);

  // Buscar dados da loja
  const { data: loja } = useQuery({
    queryKey: ["loja", gerenteLojaId],
    queryFn: async () => {
      if (!gerenteLojaId) return null;

      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, possui_fechamento_tardio")
        .eq("id", gerenteLojaId)
        .single();

      if (error) throw error;
      return data as Loja;
    },
    enabled: !!gerenteLojaId,
  });

  // Buscar meta mensal
  const { data: metaMensal } = useQuery({
    queryKey: ["meta-mensal", gerenteLojaId],
    queryFn: async () => {
      if (!gerenteLojaId) return null;

      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();

      const { data, error } = await supabase
        .from("metas_mensais")
        .select("id, meta_diaria_calculada")
        .eq("loja_id", gerenteLojaId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (error) throw error;
      return data as MetaMensal | null;
    },
    enabled: !!gerenteLojaId,
  });

  // Buscar lançamentos do dia
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos", gerenteLojaId, dataHoje],
    queryFn: async () => {
      if (!gerenteLojaId) return [];

      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("id, horario, valor_acumulado")
        .eq("loja_id", gerenteLojaId)
        .eq("data", dataHoje);

      if (error) throw error;
      return data as Lancamento[];
    },
    enabled: !!gerenteLojaId,
  });

  // Mutation para salvar/atualizar lançamento
  const saveLancamentoMutation = useMutation({
    mutationFn: async ({
      horario,
      valor,
    }: {
      horario: string;
      valor: number;
    }) => {
      if (!gerenteLojaId) throw new Error("Loja não identificada");

      const lancamentoExistente = lancamentos.find(
        (l) => l.horario === horario
      );

      if (lancamentoExistente) {
        // Atualizar
        const { error } = await supabase
          .from("lancamentos_diarios")
          .update({ valor_acumulado: valor })
          .eq("id", lancamentoExistente.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase.from("lancamentos_diarios").insert([{
          loja_id: gerenteLojaId,
          data: dataHoje,
          horario: horario as "10:00" | "14:00" | "16:00" | "19:00" | "23:00",
          valor_acumulado: valor,
        }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setSelectedHorario(null);
      toast({
        title: "Lançamento salvo",
        description: "O valor foi registrado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitLancamento = async (valor: number) => {
    if (!selectedHorario) return;
    await saveLancamentoMutation.mutateAsync({
      horario: selectedHorario,
      valor,
    });
  };

  const horarios = loja?.possui_fechamento_tardio
    ? [...HORARIOS_BASE, HORARIO_TARDIO]
    : HORARIOS_BASE;

  const totalVendido =
    lancamentos.length > 0
      ? Math.max(...lancamentos.map((l) => l.valor_acumulado))
      : 0;

  const getLancamentoByHorario = (horario: string) => {
    return lancamentos.find((l) => l.horario === horario);
  };

  if (!gerenteLojaId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          Carregando informações do gerente...
        </p>
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando loja...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold">Gerente - Meta Simples</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <MetaDiariaHeader
          metaDiaria={metaMensal?.meta_diaria_calculada || 0}
          totalVendido={totalVendido}
          lojaName={loja.nome}
        />

        {!metaMensal && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Nenhuma meta mensal cadastrada para este mês. Entre em contato com
              o administrador.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Lançamentos do Dia</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {horarios.map((horario) => {
              const lancamento = getLancamentoByHorario(horario);
              return (
                <TimelineSlot
                  key={horario}
                  horario={horario}
                  valor={lancamento?.valor_acumulado}
                  isPendente={!lancamento}
                  onClick={() => setSelectedHorario(horario)}
                />
              );
            })}
          </div>
        </div>
      </main>

      <LancamentoDialog
        isOpen={!!selectedHorario}
        onClose={() => setSelectedHorario(null)}
        horario={selectedHorario || ""}
        valorAtual={
          selectedHorario
            ? getLancamentoByHorario(selectedHorario)?.valor_acumulado
            : undefined
        }
        onSubmit={handleSubmitLancamento}
        isSubmitting={saveLancamentoMutation.isPending}
      />
    </div>
  );
};

export default Gerente;
