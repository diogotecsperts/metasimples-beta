import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LojasManager } from "@/components/admin/LojasManager";
import { GerentesManager } from "@/components/admin/GerentesManager";
import { MetasManager } from "@/components/admin/MetasManager";
import { AdminsManager } from "@/components/admin/AdminsManager";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { AlertasPerformance } from "@/components/dashboard/AlertasPerformance";
import { ResumoGeral } from "@/components/dashboard/ResumoGeral";
import { RelatoriosAutomaticos } from "@/components/dashboard/RelatoriosAutomaticos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Users, Target, Shield, BarChart3, TrendingUp, GitCompare, Mail, X } from "lucide-react";
import { format, endOfMonth, subDays } from "date-fns";
import { getTipoOperacionalLabel } from "@/lib/tipoOperacionalLabels";

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

const Admin = () => {
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

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleResetToAtual = () => {
    setMesSelecionado(new Date().getMonth() + 1);
    setAnoSelecionado(new Date().getFullYear());
  };

  // Configurar realtime para atualizar automaticamente quando houver lançamentos, lojas e metas
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("📡 Admin/Dashboard: Configurando realtime subscriptions");
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
            console.log("🔄 Admin/Dashboard: Lançamento atualizado", payload);
          }
          queryClient.invalidateQueries({ queryKey: ["lancamentos-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["lancamentos-ontem"] });
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log("📡 Admin/Dashboard: Status da subscription de lançamentos:", status);
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
            console.log("🔄 Admin/Dashboard: Lojas atualizadas");
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
            console.log("🔄 Admin/Dashboard: Metas atualizadas");
          }
          queryClient.invalidateQueries({ queryKey: ["metas-dashboard"] });
        }
      )
      .subscribe();

    return () => {
      if (import.meta.env.DEV) {
        console.log("📡 Admin/Dashboard: Removendo subscriptions");
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

  // Calcular totais para Resumo Geral
  const metaTotal = metas.reduce((acc, m) => acc + m.meta_diaria_calculada, 0);
  const vendasTotal = ranking.reduce((acc, r) => acc + r.totalVendido, 0);
  const atingimentoGeral = metaTotal > 0 ? (vendasTotal / metaTotal) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Painel Administrativo"
        subtitle="Gestão de lojas, gerentes, metas e administradores"
        onLogout={handleLogout}
        showLogo={true}
        rightContent={
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <BarChart3 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Ver Ranking</span>
          </Button>
        }
      />
      
      <PageContainer>
        <Tabs defaultValue="ranking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 gap-1 lg:w-auto lg:inline-grid lg:grid-cols-8">
            {/* Grupo Dashboard */}
            <TabsTrigger value="ranking" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Ranking</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Evolução</span>
            </TabsTrigger>
            <TabsTrigger value="comparacao" className="gap-2">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Comparação</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>

            {/* Separador visual - visível apenas em desktop */}
            <div className="hidden lg:flex items-center justify-center col-span-0">
              <div className="w-px h-6 bg-border mx-1" />
            </div>

            {/* Grupo Gestão */}
            <TabsTrigger value="lojas" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Lojas</span>
            </TabsTrigger>
            <TabsTrigger value="gerentes" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Gerentes</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admins</span>
            </TabsTrigger>
          </TabsList>

          {/* Conteúdo Dashboard - Ranking */}
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
                    lojasComMeta={lojasComMeta.length}
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
                      value={mesSelecionado.toString()}
                      onValueChange={(value) => setMesSelecionado(parseInt(value))}
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
                      onValueChange={(value) => setAnoSelecionado(parseInt(value))}
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

                    {!isAtual && (
                      <Button variant="outline" size="sm" onClick={handleResetToAtual}>
                        Voltar para Hoje
                      </Button>
                    )}

                    {temFiltrosAtivos && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLimparFiltros}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Limpar Filtros
                      </Button>
                    )}

                    {isAtual && (
                      <RealtimeIndicator isConnected={isRealtimeConnected} />
                    )}
                  </div>

                  {/* Alertas de Performance */}
                  <AlertasPerformance 
                    lojas={lojasComMeta}
                    isAtual={isAtual}
                  />

                  {/* Cards de Ranking */}
                  <div className="space-y-2">
                    {temFiltrosAtivos && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                        <Badge variant="secondary">
                          {ranking.length} {ranking.length === 1 ? "loja encontrada" : "lojas encontradas"}
                        </Badge>
                      </div>
                    )}

                    {ranking.length === 0 && temFiltrosAtivos ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Nenhuma loja encontrada com os filtros aplicados.
                      </div>
                    ) : ranking.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Nenhuma loja com meta configurada ainda.
                      </div>
                    ) : (
                      ranking.map((item, index) => (
                        <RankingCard
                          key={item.lojaId}
                          posicao={index + 1}
                          nomeLoja={item.nomeLoja}
                          metaDiaria={item.metaDiaria}
                          totalVendido={item.totalVendido}
                          percentualAtingimento={item.percentualAtingimento}
                          tendencia={item.tendencia}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Conteúdo Dashboard - Evolução Mensal */}
          <TabsContent value="evolucao" className="space-y-6">
            <MonthlyEvolutionChart />
          </TabsContent>

          {/* Conteúdo Dashboard - Comparação */}
          <TabsContent value="comparacao" className="space-y-6">
            <PeriodComparison />
          </TabsContent>

          {/* Conteúdo Dashboard - Relatórios */}
          <TabsContent value="relatorios" className="space-y-6">
            <RelatoriosAutomaticos />
          </TabsContent>

          {/* Conteúdo Gestão */}

          <TabsContent value="lojas" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <LojasManager />
            </div>
          </TabsContent>

          <TabsContent value="gerentes" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <GerentesManager />
            </div>
          </TabsContent>

          <TabsContent value="metas" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <MetasManager />
            </div>
          </TabsContent>

          <TabsContent value="admins" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <AdminsManager />
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
};

export default Admin;
