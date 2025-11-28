import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { format } from "date-fns";

type Loja = {
  id: string;
  nome: string;
};

type MetaMensal = {
  loja_id: string;
  meta_diaria_calculada: number;
};

type Lancamento = {
  loja_id: string;
  valor_acumulado: number;
};

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
};

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  // Configurar realtime para atualizar automaticamente quando houver lançamentos
  useEffect(() => {
    console.log("📡 Dashboard: Configurando realtime subscription");

    const channel = supabase
      .channel("lancamentos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Escuta INSERT, UPDATE, DELETE
          schema: "public",
          table: "lancamentos_diarios",
        },
        (payload) => {
          console.log("🔄 Dashboard: Lançamento atualizado", payload);
          // Invalidar queries para recarregar dados
          queryClient.invalidateQueries({ queryKey: ["lancamentos-dashboard"] });
        }
      )
      .subscribe((status) => {
        console.log("📡 Dashboard: Status da subscription:", status);
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      console.log("📡 Dashboard: Removendo subscription");
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [queryClient, dataHoje]);

  // Buscar todas as lojas
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Loja[];
    },
  });

  // Buscar metas mensais do mês atual
  const { data: metas = [] } = useQuery({
    queryKey: ["metas-dashboard", mesAtual, anoAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("loja_id, meta_diaria_calculada")
        .eq("mes", mesAtual)
        .eq("ano", anoAtual);

      if (error) throw error;
      return data as MetaMensal[];
    },
  });

  // Buscar lançamentos do dia
  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["lancamentos-dashboard", dataHoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("loja_id, valor_acumulado")
        .eq("data", dataHoje);

      if (error) throw error;
      return data as Lancamento[];
    },
  });

  // Processar ranking
  const ranking: RankingItem[] = lojas
    .map((loja) => {
      const meta = metas.find((m) => m.loja_id === loja.id);
      const lancamentosLoja = lancamentos.filter(
        (l) => l.loja_id === loja.id
      );
      const totalVendido =
        lancamentosLoja.length > 0
          ? Math.max(...lancamentosLoja.map((l) => l.valor_acumulado))
          : 0;
      const metaDiaria = meta?.meta_diaria_calculada || 0;
      const percentualAtingimento =
        metaDiaria > 0 ? (totalVendido / metaDiaria) * 100 : 0;

      return {
        lojaId: loja.id,
        nomeLoja: loja.nome,
        metaDiaria,
        totalVendido,
        percentualAtingimento,
      };
    })
    .sort((a, b) => b.percentualAtingimento - a.percentualAtingimento);

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-xl">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-8 py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <RankingHeader totalLojas={lojas.length} dataAtual={dataFormatada} />
          </div>
          <RealtimeIndicator isConnected={isRealtimeConnected} />
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-lg">
            <p className="text-xl text-muted-foreground">
              Nenhuma loja com dados para exibir no ranking.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Certifique-se de que há lojas cadastradas e metas mensais
              configuradas.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ranking.map((item, index) => (
              <RankingCard
                key={item.lojaId}
                posicao={index + 1}
                nomeLoja={item.nomeLoja}
                metaDiaria={item.metaDiaria}
                totalVendido={item.totalVendido}
                percentualAtingimento={item.percentualAtingimento}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
