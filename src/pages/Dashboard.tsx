import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { AlertasPerformance } from "@/components/dashboard/AlertasPerformance";
import { ResumoGeral } from "@/components/dashboard/ResumoGeral";
import { RelatoriosAutomaticos } from "@/components/dashboard/RelatoriosAutomaticos";
import { WhatsAppAutomatico } from "@/components/dashboard/WhatsAppAutomatico";
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
import { X, MessageSquare } from "lucide-react";

const MASTER_ADMIN_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

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
  updated_at: string;
  horario: string | null;
};

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
  tendencia: number | null;
  ultimaAtualizacao?: string;
  ultimoHorario?: string | null;
};

type DashboardProps = {
  embedded?: boolean;
};

const Dashboard = ({ embedded = false }: DashboardProps) => {
  const { signOut, user } = useAuth();
  const isMasterAdmin = user?.id === MASTER_ADMIN_ID;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date().getDate());
  const [filtroTipoOperacional, setFiltroTipoOperacional] = useState<"todos" | "A" | "B">("todos");
  const [filtroFechamentoTardio, setFiltroFechamentoTardio] = useState<"todos" | "sim" | "nao">("todos");
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  
  const hoje = new Date();
  const isAtual = mesSelecionado === (hoje.getMonth() + 1) && 
                  anoSelecionado === hoje.getFullYear() &&
                  diaSelecionado === hoje.getDate();
  
  // Data selecionada formatada
  const dataSelecionada = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`;
  const dataOntem = format(subDays(new Date(anoSelecionado, mesSelecionado - 1, diaSelecionado), 1), "yyyy-MM-dd");

  // Gerar lista de dias disponíveis
  const isAtualMes = mesSelecionado === (hoje.getMonth() + 1) && anoSelecionado === hoje.getFullYear();
  const ultimoDiaMes = endOfMonth(new Date(anoSelecionado, mesSelecionado - 1)).getDate();
  const diasDisponiveis = isAtualMes 
    ? Array.from({ length: hoje.getDate() }, (_, i) => i + 1)
    : Array.from({ length: ultimoDiaMes }, (_, i) => i + 1);

  // Reset dia quando mudar mês/ano
  const handleMesChange = (value: string) => {
    const novoMes = parseInt(value);
    setMesSelecionado(novoMes);
    // Se mês atual, ajusta dia para não ultrapassar hoje
    if (novoMes === (hoje.getMonth() + 1) && anoSelecionado === hoje.getFullYear()) {
      if (diaSelecionado > hoje.getDate()) {
        setDiaSelecionado(hoje.getDate());
      }
    } else {
      // Se mês anterior, ajusta para último dia se necessário
      const ultimoDia = endOfMonth(new Date(anoSelecionado, novoMes - 1)).getDate();
      if (diaSelecionado > ultimoDia) {
        setDiaSelecionado(ultimoDia);
      }
    }
  };

  const handleAnoChange = (value: string) => {
    const novoAno = parseInt(value);
    setAnoSelecionado(novoAno);
    // Ajustar dia se necessário
    if (mesSelecionado === (hoje.getMonth() + 1) && novoAno === hoje.getFullYear()) {
      if (diaSelecionado > hoje.getDate()) {
        setDiaSelecionado(hoje.getDate());
      }
    }
  };

  const handleResetToAtual = () => {
    setMesSelecionado(hoje.getMonth() + 1);
    setAnoSelecionado(hoje.getFullYear());
    setDiaSelecionado(hoje.getDate());
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
  }, [queryClient]);

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

  // Buscar lançamentos do dia selecionado
  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["lancamentos-dashboard", dataSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("loja_id, valor_acumulado, updated_at, horario")
        .eq("data", dataSelecionada);

      if (error) throw error;
      return data as Lancamento[];
    },
  });

  // Buscar lançamentos do dia anterior para calcular tendência
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

      // Calcular tendência comparando com dia anterior
      let tendencia: number | null = null;
      if (meta && metaDiaria > 0) {
        const lancamentoOntem = lancamentosOntem.find((l) => l.loja_id === loja.id);
        if (lancamentoOntem) {
          const totalOntem = lancamentoOntem.valor_acumulado;
          const percentualOntem = (totalOntem / metaDiaria) * 100;
          tendencia = percentualAtingimento - percentualOntem;
        }
      }

      // Encontrar última atualização (lançamento mais recente por updated_at)
      let ultimaAtualizacao: string | undefined;
      let ultimoHorario: string | null | undefined;
      if (lancamentosLoja.length > 0) {
        const lancamentoMaisRecente = lancamentosLoja.reduce((prev, curr) => 
          new Date(curr.updated_at) > new Date(prev.updated_at) ? curr : prev
        );
        ultimaAtualizacao = lancamentoMaisRecente.updated_at;
        ultimoHorario = lancamentoMaisRecente.horario;
      }

      return {
        lojaId: loja.id,
        nomeLoja: loja.nome,
        metaDiaria,
        totalVendido,
        percentualAtingimento,
        tendencia,
        ultimaAtualizacao,
        ultimoHorario,
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

  // Preparar dados para componente de alertas (usa dados já processados do ranking)
  const lojasEmAlerta = rankingCompleto
    .filter((item) => item.metaDiaria > 0 && item.percentualAtingimento > 0 && item.percentualAtingimento < 70)
    .map((item) => ({
      nome: item.nomeLoja,
      percentual: item.percentualAtingimento,
    }))
    .sort((a, b) => a.percentual - b.percentual);

  // Contagem de lojas com meta para ResumoGeral
  const lojasComMeta = rankingCompleto.filter((item) => item.metaDiaria > 0).length;

  const dataFormatada = new Date(anoSelecionado, mesSelecionado - 1, diaSelecionado).toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nomeMesSelecionado = new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  // Calcular totais para Resumo Geral
  const metaTotal = metas.reduce((acc, m) => acc + m.meta_diaria_calculada, 0);
  const vendasTotal = ranking.reduce((acc, r) => acc + r.totalVendido, 0);
  const atingimentoGeral = metaTotal > 0 ? (vendasTotal / metaTotal) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {!embedded && (
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
      )}
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className={`grid w-full mb-6 ${isMasterAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
            <TabsTrigger value="comparacao">Comparação</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
            {isMasterAdmin && (
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
            )}
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
                {/* Resumo Geral - Apenas no período atual */}
                {isAtual && (
                  <ResumoGeral 
                    metaTotal={metaTotal}
                    vendasTotal={vendasTotal}
                    atingimentoGeral={atingimentoGeral}
                    lojasComMeta={lojasComMeta}
                    totalLojas={lojas.length}
                  />
                )}

                <div className="flex flex-col gap-4">
                  <RankingHeader totalLojas={lojas.length} dataAtual={dataFormatada} />
                  
                  {/* Barra unificada de filtros */}
                  <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 p-4 bg-card border rounded-xl">
                    {/* Select de lojas */}
                    <Select
                      value={filtroLoja}
                      onValueChange={setFiltroLoja}
                    >
                      <SelectTrigger className="w-full col-span-2 md:w-[180px] md:col-span-1">
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
                      value={diaSelecionado.toString()}
                      onValueChange={(value) => setDiaSelecionado(parseInt(value))}
                    >
                      <SelectTrigger className="w-full md:w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {diasDisponiveis.map((dia) => (
                          <SelectItem key={dia} value={dia.toString()}>
                            Dia {dia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={mesSelecionado.toString()}
                      onValueChange={handleMesChange}
                    >
                      <SelectTrigger className="w-full md:w-[130px]">
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
                      onValueChange={handleAnoChange}
                    >
                      <SelectTrigger className="w-full md:w-[100px]">
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
                      <SelectTrigger className="w-full md:w-[150px]">
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
                      <SelectTrigger className="w-full md:w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="sim">Com 23:00</SelectItem>
                        <SelectItem value="nao">Sem 23:00</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                      {!isAtual && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetToAtual}
                          className="whitespace-nowrap"
                        >
                          Hoje
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
                  </div>

                  {/* Alertas de performance */}
                  <AlertasPerformance isAtual={isAtual} lojasEmAlerta={lojasEmAlerta} />
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
                          ultimaAtualizacao={item.ultimaAtualizacao}
                          ultimoHorario={item.ultimoHorario}
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

          <TabsContent value="relatorios">
            <RelatoriosAutomaticos />
          </TabsContent>

          {isMasterAdmin && (
            <TabsContent value="whatsapp">
              <WhatsAppAutomatico />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
