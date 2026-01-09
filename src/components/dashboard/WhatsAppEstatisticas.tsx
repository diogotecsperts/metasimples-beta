import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Clock, CheckCheck, Send, Phone, User } from "lucide-react";
import { format, subDays, differenceInMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

interface LogEntry {
  id: string;
  enviado_em: string;
  status: string;
  status_entrega: string | null;
  webhook_recebido_em: string | null;
  confirmacao_manual?: boolean;
  metodo_envio?: string | null;
  // Relatórios
  admin_id?: string;
  admin_nome?: string;
  is_test?: boolean;
  // Cobranças
  gerente_id?: string;
  nivel_cobranca?: number;
}

// Lista fixa dos 3 administradores
const ADMINISTRADORES = [
  { id: "ca936b16-8a15-43f4-976d-6be91e294099", nome: "Diogo DEV" },
  { id: "766164b8-23c5-490a-8409-412e8651da33", nome: "Thiago" },
  { id: "687d830b-4bad-4e39-9273-fab71f0d4bd0", nome: "Dyogo" },
];

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--chart-1))",
  },
  confirmados: {
    label: "Confirmados",
    color: "hsl(var(--chart-2))",
  },
  falhou: {
    label: "Falhou",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const pieChartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function WhatsAppEstatisticas() {
  const [periodo, setPeriodo] = useState("30");
  const [filtroDestinatario, setFiltroDestinatario] = useState("todos");

  // Buscar logs de relatórios
  const { data: logsRelatorios = [], isLoading: isLoadingRelatorios } = useQuery({
    queryKey: ["whatsapp-report-log-stats", periodo],
    queryFn: async () => {
      const dataLimite = subDays(new Date(), parseInt(periodo));
      const { data, error } = await supabase
        .from("whatsapp_report_log")
        .select("*")
        .gte("enviado_em", dataLimite.toISOString())
        .order("enviado_em", { ascending: true });
      if (error) throw error;
      return data as LogEntry[];
    },
  });

  // Buscar logs de cobranças
  const { data: logsCobrancas = [], isLoading: isLoadingCobrancas } = useQuery({
    queryKey: ["whatsapp-cobranca-log-stats", periodo],
    queryFn: async () => {
      const dataLimite = subDays(new Date(), parseInt(periodo));
      const { data, error } = await supabase
        .from("whatsapp_cobranca_log")
        .select("*")
        .gte("enviado_em", dataLimite.toISOString())
        .order("enviado_em", { ascending: true });
      if (error) throw error;
      return data as LogEntry[];
    },
  });

  // Buscar gerentes para nomes
  const { data: gerentes = [] } = useQuery({
    queryKey: ["gerentes-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, user_roles!inner(role)")
        .eq("user_roles.role", "gerente");
      if (error) throw error;
      return data.map(g => ({ id: g.id, nome: g.nome }));
    },
  });

  const isLoading = isLoadingRelatorios || isLoadingCobrancas;

  // Combinar todos os logs
  const todosLogs = useMemo(() => {
    return [...logsRelatorios, ...logsCobrancas];
  }, [logsRelatorios, logsCobrancas]);

  // Filtrar logs por destinatário
  const logsFiltrados = useMemo(() => {
    if (filtroDestinatario === "todos") return todosLogs;
    
    // Verificar se é um admin
    const isAdmin = ADMINISTRADORES.some(a => a.id === filtroDestinatario);
    if (isAdmin) {
      return logsRelatorios.filter(l => l.admin_id === filtroDestinatario);
    }
    
    // É um gerente
    return logsCobrancas.filter(l => l.gerente_id === filtroDestinatario);
  }, [todosLogs, logsRelatorios, logsCobrancas, filtroDestinatario]);

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const total = logsFiltrados.length;
    const confirmados = logsFiltrados.filter(l => 
      l.status_entrega === "enviado" || l.confirmacao_manual
    ).length;
    const falhou = logsFiltrados.filter(l => 
      l.status_entrega !== "enviado" && l.status_entrega !== "aceito" && l.status !== "enviado"
    ).length;
    const taxaSucesso = total > 0 ? ((confirmados / total) * 100).toFixed(1) : "0";

    // Tempo médio de confirmação
    let temposTotais = 0;
    let contagemTempos = 0;
    
    logsFiltrados.forEach(log => {
      if (log.webhook_recebido_em && log.enviado_em) {
        try {
          const enviado = new Date(log.enviado_em);
          const recebido = new Date(log.webhook_recebido_em);
          if (isValid(enviado) && isValid(recebido)) {
            const diffMinutos = differenceInMinutes(recebido, enviado);
            if (diffMinutos >= 0 && diffMinutos < 60) {
              temposTotais += diffMinutos;
              contagemTempos++;
            }
          }
        } catch {
          // Ignora erros de parsing
        }
      }
    });

    const tempoMedio = contagemTempos > 0 ? Math.round(temposTotais / contagemTempos) : 0;

    return { total, confirmados, falhou, taxaSucesso, tempoMedio };
  }, [logsFiltrados]);

  // Dados para gráfico de envios por dia
  const dadosPorDia = useMemo(() => {
    const diasMap = new Map<string, { total: number; confirmados: number; falhou: number }>();
    
    logsFiltrados.forEach(log => {
      try {
        const data = new Date(log.enviado_em);
        if (!isValid(data)) return;
        
        const diaKey = format(data, "yyyy-MM-dd");
        const atual = diasMap.get(diaKey) || { total: 0, confirmados: 0, falhou: 0 };
        
        atual.total++;
        if (log.status_entrega === "enviado" || log.confirmacao_manual) {
          atual.confirmados++;
        } else if (log.status_entrega !== "aceito" && log.status !== "enviado") {
          atual.falhou++;
        }
        
        diasMap.set(diaKey, atual);
      } catch {
        // Ignora erros
      }
    });

    return Array.from(diasMap.entries())
      .map(([data, valores]) => ({
        data,
        dataFormatada: format(new Date(data), "dd/MM", { locale: ptBR }),
        ...valores,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [logsFiltrados]);

  // Dados para gráfico de via de envio
  const dadosVia = useMemo(() => {
    let telefone = 0;
    let contactId = 0;
    
    logsFiltrados.forEach(log => {
      if (log.metodo_envio === "contact_id") {
        contactId++;
      } else {
        telefone++;
      }
    });

    return [
      { name: "Telefone", value: telefone, fill: pieChartColors[0] },
      { name: "Contact ID", value: contactId, fill: pieChartColors[1] },
    ].filter(d => d.value > 0);
  }, [logsFiltrados]);

  // Dados para gráfico de taxa por destinatário
  const dadosPorDestinatario = useMemo(() => {
    const destinatariosMap = new Map<string, { nome: string; total: number; confirmados: number }>();
    
    // Processar relatórios
    logsRelatorios.forEach(log => {
      if (filtroDestinatario !== "todos" && log.admin_id !== filtroDestinatario) return;
      
      const id = log.admin_id || "unknown";
      const nome = log.admin_nome || "Admin";
      const atual = destinatariosMap.get(id) || { nome, total: 0, confirmados: 0 };
      
      atual.total++;
      if (log.status_entrega === "enviado" || log.confirmacao_manual) {
        atual.confirmados++;
      }
      
      destinatariosMap.set(id, atual);
    });

    // Processar cobranças
    logsCobrancas.forEach(log => {
      if (filtroDestinatario !== "todos" && log.gerente_id !== filtroDestinatario) return;
      
      const id = log.gerente_id || "unknown";
      const gerente = gerentes.find(g => g.id === id);
      const nome = gerente?.nome || "Gerente";
      const atual = destinatariosMap.get(id) || { nome, total: 0, confirmados: 0 };
      
      atual.total++;
      if (log.status_entrega === "enviado" || log.confirmacao_manual) {
        atual.confirmados++;
      }
      
      destinatariosMap.set(id, atual);
    });

    return Array.from(destinatariosMap.entries())
      .map(([id, data]) => ({
        id,
        nome: data.nome.length > 15 ? data.nome.substring(0, 12) + "..." : data.nome,
        taxa: data.total > 0 ? Math.round((data.confirmados / data.total) * 100) : 0,
        total: data.total,
      }))
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 10);
  }, [logsRelatorios, logsCobrancas, gerentes, filtroDestinatario]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Estatísticas de Envio</CardTitle>
                <CardDescription>
                  Métricas de desempenho do sistema de WhatsApp
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filtroDestinatario} onValueChange={setFiltroDestinatario}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Destinatário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ADMINISTRADORES.map(admin => (
                    <SelectItem key={admin.id} value={admin.id}>
                      👤 {admin.nome}
                    </SelectItem>
                  ))}
                  {gerentes.map(gerente => (
                    <SelectItem key={gerente.id} value={gerente.id}>
                      🏪 {gerente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Send className="h-4 w-4" />
              <span className="text-sm">Total de Envios</span>
            </div>
            <p className="text-3xl font-bold">{estatisticas.total}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Taxa de Sucesso</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{estatisticas.taxaSucesso}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCheck className="h-4 w-4" />
              <span className="text-sm">Confirmados</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{estatisticas.confirmados}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Tempo Médio</span>
            </div>
            <p className="text-3xl font-bold">
              {estatisticas.tempoMedio > 0 ? `${estatisticas.tempoMedio}min` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de envios por dia */}
      {dadosPorDia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Envios por Dia</CardTitle>
            <CardDescription>
              Volume de mensagens enviadas nos últimos {periodo} dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={dadosPorDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="dataFormatada" 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  fill="var(--color-total)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="confirmados"
                  stroke="var(--color-confirmados)"
                  fill="var(--color-confirmados)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="falhou"
                  stroke="var(--color-falhou)"
                  fill="var(--color-falhou)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Grid de gráficos menores */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Taxa por destinatário */}
        {dadosPorDestinatario.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Taxa de Sucesso por Destinatário</CardTitle>
              <CardDescription>
                Percentual de confirmação por pessoa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart 
                  data={dadosPorDestinatario} 
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    width={80}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{data.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            Taxa: {data.taxa}% ({data.total} envios)
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="taxa" 
                    fill="hsl(var(--chart-2))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Via de envio */}
        {dadosVia.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Via de Envio</CardTitle>
              <CardDescription>
                Telefone vs Contact ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={dadosVia}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {dadosVia.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <div className="flex items-center gap-2">
                            {data.name === "Telefone" ? (
                              <Phone className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                            <span className="font-medium">{data.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {data.value} envios
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {todosLogs.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum dado disponível para o período selecionado</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
