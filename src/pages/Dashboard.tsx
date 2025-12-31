import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RankingHeader } from "@/components/dashboard/RankingHeader";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { RankingCardMensal } from "@/components/dashboard/RankingCardMensal";
import { RealtimeIndicator } from "@/components/dashboard/RealtimeIndicator";
import { MonthlyEvolutionChart } from "@/components/dashboard/MonthlyEvolutionChart";
import { PeriodComparison } from "@/components/dashboard/PeriodComparison";
import { AlertasPerformance } from "@/components/dashboard/AlertasPerformance";
import { ResumoGeral } from "@/components/dashboard/ResumoGeral";
import { RelatoriosAutomaticos } from "@/components/dashboard/RelatoriosAutomaticos";
import { WhatsAppAutomatico } from "@/components/dashboard/WhatsAppAutomatico";
import { ExportRankingButton } from "@/components/dashboard/ExportRankingButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTipoOperacionalLabel } from "@/lib/tipoOperacionalLabels";
import { X, MessageSquare, CalendarDays, Calendar } from "lucide-react";
import { calcularMetasDiariasComAjustes, type AjusteDiario } from "@/lib/calcularMetaDiariaComAjustes";
import { fetchLancamentosMensais } from "@/lib/fetchAllPaged";
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
  meta_mensal: number;
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
  ultimaAtualizacao?: string;
  ultimoHorario?: string | null;
};

type DashboardProps = {
  embedded?: boolean;
};

const Dashboard = ({ embedded = false }: DashboardProps) => {
  const { signOut, user, userName } = useAuth();
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
  const [visaoMensal, setVisaoMensal] = useState(false);
  const rankingContainerRef = useRef<HTMLDivElement>(null);
  
  const hoje = new Date();
  const isAtual = mesSelecionado === (hoje.getMonth() + 1) && 
                  anoSelecionado === hoje.getFullYear() &&
                  diaSelecionado === hoje.getDate();
  
  // Data selecionada formatada
  const dataSelecionada = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`;

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
          queryClient.invalidateQueries({ queryKey: ["lancamentos-mensais"] });
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
        .select("loja_id, meta_diaria_calculada, meta_mensal")
        .eq("mes", mesSelecionado)
        .eq("ano", anoSelecionado);

      if (error) throw error;
      return data as MetaMensal[];
    },
  });

  // Buscar todos os lançamentos do mês para visão mensal (com paginação para evitar limite de 1000)
  const { data: lancamentosMensais = [] } = useQuery({
    queryKey: ["lancamentos-mensais", mesSelecionado, anoSelecionado],
    queryFn: async () => {
      const primeiroDia = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-01`;
      const ultimoDia = format(endOfMonth(new Date(anoSelecionado, mesSelecionado - 1)), "yyyy-MM-dd");
      
      return fetchLancamentosMensais(primeiroDia, ultimoDia);
    },
    enabled: visaoMensal, // Só busca quando visão mensal está ativa
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

  // Buscar ajustes diários para o mês selecionado
  const { data: ajustesDiarios = [] } = useQuery({
    queryKey: ["ajustes-diarios-dashboard", mesSelecionado, anoSelecionado],
    queryFn: async () => {
      const primeiroDia = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-01`;
      const ultimoDia = format(endOfMonth(new Date(anoSelecionado, mesSelecionado - 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("metas_diarias_ajustes")
        .select("id, meta_mensal_id, loja_id, data, meta_original, meta_ajustada, motivo")
        .gte("data", primeiroDia)
        .lte("data", ultimoDia);
      
      if (error) throw error;
      return data as AjusteDiario[];
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
      
      // Calcular meta diária considerando ajustes manuais
      let metaDiaria = meta?.meta_diaria_calculada || 0;
      if (meta) {
        const ajustesDaLoja = ajustesDiarios.filter(a => a.loja_id === loja.id);
        if (ajustesDaLoja.length > 0) {
          const metasCalculadas = calcularMetasDiariasComAjustes(
            Number(meta.meta_mensal),
            loja.tipo_operacional,
            mesSelecionado,
            anoSelecionado,
            ajustesDaLoja
          );
          const metaHoje = metasCalculadas.find(m => m.data === dataSelecionada);
          if (metaHoje) {
            metaDiaria = metaHoje.metaCalculada;
          }
        }
      }
      
      const percentualAtingimento =
        metaDiaria > 0 ? (totalVendido / metaDiaria) * 100 : 0;

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

  // Verificar se o dia selecionado é domingo (antes dos filtros)
  const dataSelecionadaObj = new Date(anoSelecionado, mesSelecionado - 1, diaSelecionado);
  const isDomingo = dataSelecionadaObj.getDay() === 0;

  // Aplicar filtros (inclui exclusão de lojas Tipo B aos domingos)
  const ranking = rankingCompleto.filter((item) => {
    const loja = lojas.find((l) => l.id === item.lojaId);
    if (!loja) return false;

    // Se for domingo, excluir lojas Tipo B (Seg a Sáb) - não operam aos domingos
    if (isDomingo && loja.tipo_operacional === "B") {
      return false;
    }

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

  // Processar ranking mensal
  const rankingMensal = useMemo(() => {
    if (!lojas || !metas || !lancamentosMensais) return [];

    return lojas
      .map((loja) => {
        const meta = metas.find((m) => m.loja_id === loja.id);
        const lancamentosLoja = lancamentosMensais.filter((l) => l.loja_id === loja.id);

        // Agrupar por dia e pegar máximo de cada dia
        const porDia = new Map<string, number>();
        lancamentosLoja.forEach((l) => {
          const atual = porDia.get(l.data) || 0;
          porDia.set(l.data, Math.max(atual, Number(l.valor_acumulado)));
        });

        // Somar todos os dias
        const totalVendidoMes = Array.from(porDia.values()).reduce((a, b) => a + b, 0);
        const metaMensal = meta?.meta_mensal ? Number(meta.meta_mensal) : null;
        const percentual = metaMensal ? (totalVendidoMes / metaMensal) * 100 : null;

        return {
          lojaId: loja.id,
          nomeLoja: loja.nome,
          metaMensal,
          totalVendidoMes,
          percentualAtingimento: percentual,
          tipoOperacional: loja.tipo_operacional,
          possuiFechamentoTardio: loja.possui_fechamento_tardio,
        };
      })
      .filter((item) => {
        // Aplicar mesmos filtros do ranking diário
        if (filtroTipoOperacional !== "todos" && item.tipoOperacional !== filtroTipoOperacional) {
          return false;
        }
        if (filtroFechamentoTardio !== "todos") {
          if (filtroFechamentoTardio === "sim" && !item.possuiFechamentoTardio) return false;
          if (filtroFechamentoTardio === "nao" && item.possuiFechamentoTardio) return false;
        }
        if (filtroLoja !== "todas" && item.lojaId !== filtroLoja) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Lojas sem meta vão para o final
        if (a.metaMensal === null && b.metaMensal === null) return 0;
        if (a.metaMensal === null) return 1;
        if (b.metaMensal === null) return -1;
        return (b.percentualAtingimento || 0) - (a.percentualAtingimento || 0);
      });
  }, [lojas, metas, lancamentosMensais, filtroTipoOperacional, filtroFechamentoTardio, filtroLoja]);

  // Preparar dados para componente de alertas (usa dados já processados do ranking filtrado)
  const lojasEmAlerta = ranking
    .filter((item) => item.metaDiaria > 0 && item.percentualAtingimento > 0 && item.percentualAtingimento < 70)
    .map((item) => ({
      nome: item.nomeLoja,
      percentual: item.percentualAtingimento,
    }))
    .sort((a, b) => a.percentual - b.percentual);

  // Contagem de lojas com meta para ResumoGeral (ranking já está filtrado por dia)
  const lojasComMeta = ranking.filter((item) => item.metaDiaria > 0).length;

  const dataFormatada = dataSelecionadaObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nomeMesSelecionado = new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  // Calcular totais para Resumo Geral (ranking já está filtrado por dia)
  const rankingComMeta = ranking.filter((item) => item.metaDiaria > 0);
  const metaTotal = rankingComMeta.reduce((acc, r) => acc + r.metaDiaria, 0);
  const vendasTotal = rankingComMeta.reduce((acc, r) => acc + r.totalVendido, 0);
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
          <TabsList className={`
            flex flex-col w-full gap-1 mb-6 h-auto p-1
            md:grid md:h-auto ${isMasterAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'}
          `}>
            <TabsTrigger value="ranking" className="w-full justify-center">Ranking</TabsTrigger>
            <TabsTrigger value="evolucao" className="w-full justify-center">Evolução Mensal</TabsTrigger>
            <TabsTrigger value="comparacao" className="w-full justify-center">Comparação</TabsTrigger>
            <TabsTrigger value="relatorios" className="w-full justify-center">Relatórios</TabsTrigger>
            {isMasterAdmin && (
              <TabsTrigger value="whatsapp" className="w-full justify-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
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
                    totalLojas={ranking.length}
                  />
                )}

                <div className="flex flex-col gap-4">
                  <RankingHeader totalLojas={lojas.length} dataAtual={dataFormatada} userName={userName} />
                  
                  {/* Barra unificada de filtros */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-card border rounded-xl">
                    {/* Grupo esquerda: filtros */}
                    <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
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
                    </div>

                    {/* Grupo direita: toggle, exportar e realtime */}
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      {/* Toggle Visão Diária/Mensal */}
                      <Button
                        variant={visaoMensal ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVisaoMensal(!visaoMensal)}
                        className="gap-2"
                      >
                        {visaoMensal ? (
                          <>
                            <Calendar className="h-4 w-4" />
                            Visão Mensal
                          </>
                        ) : (
                          <>
                            <CalendarDays className="h-4 w-4" />
                            Visão Diária
                          </>
                        )}
                      </Button>

                      {visaoMensal ? (
                        <ExportRankingButton
                          ranking={rankingMensal.map(item => ({
                            lojaId: item.lojaId,
                            nomeLoja: item.nomeLoja,
                            metaDiaria: item.metaMensal || 0,
                            totalVendido: item.totalVendidoMes,
                            percentualAtingimento: item.percentualAtingimento || 0,
                          }))}
                          dataFormatada={`${nomeMesSelecionado.charAt(0).toUpperCase() + nomeMesSelecionado.slice(1)} de ${anoSelecionado}`}
                          metaTotal={rankingMensal.filter(r => r.metaMensal !== null).reduce((acc, r) => acc + (r.metaMensal || 0), 0)}
                          vendasTotal={rankingMensal.reduce((acc, r) => acc + r.totalVendidoMes, 0)}
                          atingimentoGeral={(() => {
                            const metaTotalMensal = rankingMensal.filter(r => r.metaMensal !== null).reduce((acc, r) => acc + (r.metaMensal || 0), 0);
                            const vendasTotalMensal = rankingMensal.reduce((acc, r) => acc + r.totalVendidoMes, 0);
                            return metaTotalMensal > 0 ? (vendasTotalMensal / metaTotalMensal) * 100 : 0;
                          })()}
                          isMensal={true}
                        />
                      ) : (
                        <ExportRankingButton
                          ranking={ranking}
                          dataFormatada={dataFormatada}
                          metaTotal={metaTotal}
                          vendasTotal={vendasTotal}
                          atingimentoGeral={atingimentoGeral}
                          rankingContainerRef={rankingContainerRef}
                        />
                      )}

                      {isAtual && !visaoMensal && (
                        <RealtimeIndicator isConnected={isRealtimeConnected} />
                      )}
                    </div>
                  </div>

                  {/* Alertas de performance - só na visão diária */}
                  {!visaoMensal && (
                    <AlertasPerformance isAtual={isAtual} lojasEmAlerta={lojasEmAlerta} />
                  )}
                </div>

                {visaoMensal ? (
                  // Visão Mensal
                  rankingMensal.filter(r => r.metaMensal !== null).length === 0 ? (
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
                      {rankingMensal.map((item, index) => (
                        <RankingCardMensal
                          key={item.lojaId}
                          posicao={index + 1}
                          nomeLoja={item.nomeLoja}
                          metaMensal={item.metaMensal}
                          totalVendidoMes={item.totalVendidoMes}
                          percentualAtingimento={item.percentualAtingimento}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  // Visão Diária
                  (() => {
                    // Verificar se existem metas mensais configuradas para o período
                    const temMetasMensaisConfiguradas = metas && metas.length > 0;
                    
                    // Verificar se todas as metas estão zeradas por ajuste manual (ex: feriado)
                    const todasMetasZeradasPorAjuste = ranking.length > 0 && 
                      ranking.every(r => r.metaDiaria === 0) &&
                      temMetasMensaisConfiguradas &&
                      ajustesDiarios.some(a => a.data === dataSelecionada);
                    
                    // Nenhuma loja no ranking (filtros ou sem dados)
                    if (ranking.length === 0) {
                      return (
                        <div className="bg-card border rounded-xl p-8 text-center">
                          <p className="text-muted-foreground mb-2">
                            {temFiltrosAtivos
                              ? "Nenhuma loja encontrada com os filtros aplicados."
                              : "Nenhuma loja encontrada para o período selecionado."}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {temFiltrosAtivos
                              ? "Tente ajustar os filtros para ver mais resultados."
                              : "Verifique as configurações de lojas e metas."}
                          </p>
                        </div>
                      );
                    }
                    
                    // Metas zeradas por ajuste manual (feriado)
                    if (todasMetasZeradasPorAjuste) {
                      return (
                        <>
                          <div className="bg-muted/50 border border-muted-foreground/20 rounded-lg p-4 mb-4 flex items-center gap-3">
                            <CalendarDays className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Metas zeradas por ajuste manual
                              </p>
                              <p className="text-xs text-muted-foreground">
                                As metas deste dia foram ajustadas para R$ 0,00. Exibindo apenas vendas realizadas.
                              </p>
                            </div>
                          </div>
                          <div ref={rankingContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {ranking.map((item, index) => (
                              <RankingCard
                                key={item.lojaId}
                                posicao={index + 1}
                                nomeLoja={item.nomeLoja}
                                metaDiaria={item.metaDiaria}
                                totalVendido={item.totalVendido}
                                percentualAtingimento={item.percentualAtingimento}
                                isEmAlerta={false}
                                ultimaAtualizacao={item.ultimaAtualizacao}
                                ultimoHorario={item.ultimoHorario}
                              />
                            ))}
                          </div>
                        </>
                      );
                    }
                    
                    // Sem metas mensais configuradas
                    if (!temMetasMensaisConfiguradas || ranking.filter(r => r.metaDiaria > 0).length === 0) {
                      return (
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
                      );
                    }
                    
                    // Ranking normal
                    return (
                      <div ref={rankingContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                              isEmAlerta={isEmAlerta}
                              ultimaAtualizacao={item.ultimaAtualizacao}
                              ultimoHorario={item.ultimoHorario}
                            />
                          );
                        })}
                      </div>
                    );
                  })()
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
