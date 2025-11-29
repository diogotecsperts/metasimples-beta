import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { Skeleton } from "@/components/ui/skeleton";
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
    if (import.meta.env.DEV) {
      console.log("📡 Dashboard: Configurando realtime subscription");
    }

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
          if (import.meta.env.DEV) {
            console.log("🔄 Dashboard: Lançamento atualizado", payload);
          }
          // Invalidar queries para recarregar dados
          queryClient.invalidateQueries({ queryKey: ["lancamentos-dashboard"] });
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log("📡 Dashboard: Status da subscription:", status);
        }
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (import.meta.env.DEV) {
        console.log("📡 Dashboard: Removendo subscription");
      }
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
    .sort((a, b) => {
      // Lojas sem meta vão para o final
      if (a.metaDiaria === 0 && b.metaDiaria === 0) return 0;
      if (a.metaDiaria === 0) return 1;
      if (b.metaDiaria === 0) return -1;
      
      // Ordenar por percentual de atingimento (descendente)
      return b.percentualAtingimento - a.percentualAtingimento;
    });

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-4 md:p-8">
        <div className="space-y-6 md:space-y-8">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-4 md:p-8">
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <RankingHeader totalLojas={lojas.length} dataAtual={dataFormatada} />
          <RealtimeIndicator isConnected={isRealtimeConnected} />
        </div>

        {ranking.filter(r => r.metaDiaria > 0).length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-xl shadow-md">
            <p className="text-xl md:text-2xl text-muted-foreground font-medium">
              Nenhuma loja com meta<br />configurada ainda.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure metas mensais para visualizar o ranking.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </div>
    </div>
  );
};

export default Dashboard;
