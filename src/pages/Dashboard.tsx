import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { AlertasPerformance } from "@/components/dashboard/AlertasPerformance";
import { AppHeader } from "@/components/layout/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, endOfMonth, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTipoOperacionalLabel } from "@/lib/tipoOperacionalLabels";
import { X } from "lucide-react";

type Loja = {
  id: string;
  nome: string;
  tipo_operacional: "A" | "B";
  possui_fechamento_tardio: boolean;
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
  tendencia: number | null;
};

const Dashboard = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [filtroTipoOperacional, setFiltroTipoOperacional] = useState<"todos" | "A" | "B">("todos");
  const [filtroFechamentoTardio, setFiltroFechamentoTardio] = useState<"todos" | "sim" | "nao">("todos");
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const dataOntem = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const isAtual = mesSelecionado === (new Date().getMonth() + 1) && 
                  anoSelecionado === new Date().getFullYear();

  const handleResetToAtual = () => {
    setMesSelecionado(new Date().getMonth() + 1);
    setAnoSelecionado(new Date().getFullYear());
  };

  // Configurar realtime para atualizar automaticamente quando houver lançamentos, lojas e metas
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("📡 Dashboard: Configurando realtime subscriptions");
    }

    const lancamentosChannel = supabase
      .channel("lancamentos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lancamentos_diarios",
        },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log("🔄 Dashboard: Lançamento atualizado", payload);
          }
          queryClient.invalidateQueries({ queryKey: ["lancamentos-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["lancamentos-ontem"] });
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log("📡 Dashboard: Status da subscription de lançamentos:", status);
        }
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    const lojasChannel = supabase
      .channel("lojas-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lojas",
        },
        () => {
          if (import.meta.env.DEV) {
            console.log("🔄 Dashboard: Lojas atualizadas");
          }
          queryClient.invalidateQueries({ queryKey: ["lojas-dashboard"] });
        }
      )
      .subscribe();

    const metasChannel = supabase
      .channel("metas-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "metas_mensais",
        },
        () => {
          if (import.meta.env.DEV) {
            console.log("🔄 Dashboard: Metas atualizadas");
          }
          queryClient.invalidateQueries({ queryKey: ["metas-dashboard"] });
        }
      )
      .subscribe();

    return () => {
      if (import.meta.env.DEV) {
        console.log("📡 Dashboard: Removendo subscriptions");
      }
      supabase.removeChannel(lancamentosChannel);
      supabase.removeChannel(lojasChannel);
      supabase.removeChannel(metasChannel);
      setIsRealtimeConnected(false);
    };
  }, [queryClient, dataHoje]);

  // Buscar todas as lojas
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, tipo_operacional, possui_fechamento_tardio")
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

  // Buscar lançamentos de ontem para calcular tendência
  const { data: lancamentosOntem = [] } = useQuery({
    queryKey: ["lancamentos-ontem", dataOntem],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("loja_id, valor_acumulado")
        .eq("data", dataOntem);
      
      if (error) throw error;
      return data as Lancamento[];
    },
    enabled: isAtual,
  });

  // Processar ranking
  const rankingCompleto: RankingItem[] = lojas
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

      // Calcular tendência comparando com ontem
      let tendencia: number | null = null;
      if (isAtual && meta && metaDiaria > 0) {
        const lancamentoOntem = lancamentosOntem.find((l) => l.loja_id === loja.id);
        if (lancamentoOntem) {
          const totalOntem = lancamentoOntem.valor_acumulado;
          const percentualOntem = (totalOntem / metaDiaria) * 100;
          tendencia = percentualAtingimento - percentualOntem;
        }
      }

      return {
        lojaId: loja.id,
        nomeLoja: loja.nome,
        metaDiaria,
        totalVendido,
        percentualAtingimento,
        tendencia,
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

  // Aplicar filtros
  const ranking = rankingCompleto.filter((item) => {
    const loja = lojas.find((l) => l.id === item.lojaId);
    if (!loja) return false;

    // Filtro por tipo operacional
    if (filtroTipoOperacional !== "todos" && loja.tipo_operacional !== filtroTipoOperacional) {
      return false;
    }

    // Filtro por fechamento tardio
    if (filtroFechamentoTardio !== "todos") {
      const hasFechamento = loja.possui_fechamento_tardio;
      if (filtroFechamentoTardio === "sim" && !hasFechamento) return false;
      if (filtroFechamentoTardio === "nao" && hasFechamento) return false;
    }

    // Filtro por loja específica
    if (filtroLoja !== "todas" && item.lojaId !== filtroLoja) {
      return false;
    }

    return true;
  });

  const temFiltrosAtivos = filtroTipoOperacional !== "todos" || filtroFechamentoTardio !== "todos" || filtroLoja !== "todas";

  const handleLimparFiltros = () => {
    setFiltroTipoOperacional("todos");
    setFiltroFechamentoTardio("todos");
    setFiltroLoja("todas");
  };

  // Preparar dados para componente de alertas
  const lojasComMeta = lojas
    .map((loja) => {
      const meta = metas.find((m) => m.loja_id === loja.id);
      return {
        id: loja.id,
        nome: loja.nome,
        meta_diaria: meta?.meta_diaria_calculada || 0,
      };
    })
    .filter((loja) => loja.meta_diaria > 0);

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
                  
                  {/* Barra unificada de filtros */}
                  <div className="flex flex-wrap items-center gap-2 p-4 bg-card border rounded-xl">
                    {/* Select de lojas */}
                    <Select
                      value={filtroLoja}
                      onValueChange={setFiltroLoja}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todas as lojas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as lojas</SelectItem>
                        {lojas.map((loja) => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={mesSelecionado.toString()}
                      onValueChange={(value) => setMesSelecionado(parseInt(value))}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 1, label: "Janeiro" },
                          { value: 2, label: "Fevereiro" },
                          { value: 3, label: "Março" },
                          { value: 4, label: "Abril" },
                          { value: 5, label: "Maio" },
                          { value: 6, label: "Junho" },
                          { value: 7, label: "Julho" },
                          { value: 8, label: "Agosto" },
                          { value: 9, label: "Setembro" },
                          { value: 10, label: "Outubro" },
                          { value: 11, label: "Novembro" },
                          { value: 12, label: "Dezembro" },
                        ].map((mes) => (
                          <SelectItem key={mes.value} value={mes.value.toString()}>
                            {mes.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={anoSelecionado.toString()}
                      onValueChange={(value) => setAnoSelecionado(parseInt(value))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const ano = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={ano} value={ano.toString()}>
                              {ano}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filtroTipoOperacional}
                      onValueChange={(value) => setFiltroTipoOperacional(value as "todos" | "A" | "B")}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Tipos</SelectItem>
                        <SelectItem value="A">{getTipoOperacionalLabel("A")}</SelectItem>
                        <SelectItem value="B">{getTipoOperacionalLabel("B")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={filtroFechamentoTardio}
                      onValueChange={(value) => setFiltroFechamentoTardio(value as "todos" | "sim" | "nao")}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="sim">Com 23:00</SelectItem>
                        <SelectItem value="nao">Sem 23:00</SelectItem>
                      </SelectContent>
                    </Select>

                    {!isAtual && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetToAtual}
                        className="whitespace-nowrap"
                      >
                        Período Atual
                      </Button>
                    )}

                    {temFiltrosAtivos && (
                      <>
                        <Badge variant="secondary" className="text-xs">
                          {ranking.length} {ranking.length === 1 ? "loja" : "lojas"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLimparFiltros}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Limpar
                        </Button>
                      </>
                    )}

                    {isAtual && (
                      <div className="ml-auto">
                        <RealtimeIndicator isConnected={isRealtimeConnected} />
                      </div>
                    )}
                  </div>

                  {/* Alertas de performance */}
                  <AlertasPerformance isAtual={isAtual} lojas={lojasComMeta} />
                </div>

{ranking.filter(r => r.metaDiaria > 0).length === 0 ? (
                  <div className="bg-card border rounded-xl p-8 text-center">
                    <p className="text-muted-foreground mb-2">
                      {temFiltrosAtivos
                        ? "Nenhuma loja encontrada com os filtros aplicados."
                        : `Nenhuma meta configurada para ${nomeMesSelecionado} de ${anoSelecionado}.`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {temFiltrosAtivos
                        ? "Tente ajustar os filtros para ver mais resultados."
                        : `Configure metas mensais para o ${isAtual ? "mês atual" : "período selecionado"} para visualizar o ranking.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ranking.map((item, index) => {
                      const isEmAlerta = isAtual && item.metaDiaria > 0 && item.percentualAtingimento > 0 && item.percentualAtingimento < 70;
                      return (
                        <RankingCard
                          key={item.lojaId}
                          posicao={index + 1}
                          nomeLoja={item.nomeLoja}
                          metaDiaria={item.metaDiaria}
                          totalVendido={item.totalVendido}
                          percentualAtingimento={item.percentualAtingimento}
                          tendencia={item.tendencia}
                          isEmAlerta={isEmAlerta}
                        />
                      );
                    })}
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
