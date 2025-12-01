import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { AppHeader } from "@/components/layout/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

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
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const isAtual = mesSelecionado === (new Date().getMonth() + 1) && 
                  anoSelecionado === new Date().getFullYear();

  const handleResetToAtual = () => {
    setMesSelecionado(new Date().getMonth() + 1);
    setAnoSelecionado(new Date().getFullYear());
  };

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

  // Buscar metas mensais do período selecionado
  const { data: metas = [] } = useQuery({
    queryKey: ["metas-dashboard", mesSelecionado, anoSelecionado],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("loja_id, meta_diaria_calculada")
        .eq("mes", mesSelecionado)
        .eq("ano", anoSelecionado);

      if (error) throw error;
      return data as MetaMensal[];
    },
  });

  // Buscar lançamentos do dia (atual) ou do mês (histórico)
  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["lancamentos-dashboard", mesSelecionado, anoSelecionado, isAtual ? dataHoje : null],
    queryFn: async () => {
      if (isAtual) {
        // Mês atual: busca apenas hoje
        const { data, error } = await supabase
          .from("lancamentos_diarios")
          .select("loja_id, valor_acumulado")
          .eq("data", dataHoje);

        if (error) throw error;
        return data as Lancamento[];
      } else {
        // Mês anterior: busca todo o mês
        const inicioMes = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-01`;
        const fimMes = format(endOfMonth(new Date(anoSelecionado, mesSelecionado - 1)), "yyyy-MM-dd");
        
        const { data, error } = await supabase
          .from("lancamentos_diarios")
          .select("loja_id, valor_acumulado, data")
          .gte("data", inicioMes)
          .lte("data", fimMes);

        if (error) throw error;
        return data as Lancamento[];
      }
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

  const dataFormatada = isAtual
    ? new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

  const nomeMesSelecionado = new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Ranking de Performance"
        showLogo={true}
        showLogout={true}
        onLogout={signOut}
        rightContent={
          <button
            onClick={() => navigate("/admin")}
            className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Painel Admin
          </button>
        }
      />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
            <TabsTrigger value="comparacao">Comparação</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <RankingHeader totalLojas={lojas.length} dataAtual={dataFormatada} />
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <PeriodFilter
                      mesSelecionado={mesSelecionado}
                      anoSelecionado={anoSelecionado}
                      onMesChange={setMesSelecionado}
                      onAnoChange={setAnoSelecionado}
                      onResetToAtual={handleResetToAtual}
                      isAtual={isAtual}
                    />
                    {isAtual && <RealtimeIndicator isConnected={isRealtimeConnected} />}
                  </div>
                </div>

                {ranking.filter(r => r.metaDiaria > 0).length === 0 ? (
                  <div className="bg-card border rounded-xl p-8 text-center">
                    <p className="text-muted-foreground mb-2">
                      Nenhuma meta configurada para {nomeMesSelecionado} de {anoSelecionado}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Configure metas mensais para o {isAtual ? "mês atual" : "período selecionado"} para visualizar o ranking.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              </>
            )}
          </TabsContent>

          <TabsContent value="evolucao">
            <MonthlyEvolutionChart />
          </TabsContent>

          <TabsContent value="comparacao">
            <PeriodComparison />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
