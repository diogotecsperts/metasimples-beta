import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuditLogList, type AuditLog } from "./AuditLogList";
import {
  ScrollText,
  Crown,
  Filter,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Bell,
  Clock,
  Target,
  Users,
  Shield,
  BarChart3,
  Trash2,
  CalendarIcon,
  X,
  Ban,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RangeCalendarModal } from "@/components/ui/range-calendar-modal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ACTION_LABELS, ENTITY_LABELS, type AuditAction, type AuditEntity } from "@/lib/auditLog";
import { generateAuditReport } from "@/lib/generateAuditReport";
import { cn } from "@/lib/utils";

const MASTER_ADMIN_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "7 dias" },
  { value: "30days", label: "30 dias" },
  { value: "all", label: "Todos" },
  { value: "custom", label: "Personalizado" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "Todas ações" },
  { value: "create", label: "Criações" },
  { value: "update", label: "Edições" },
  { value: "delete", label: "Exclusões" },
];

type CounterType = {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const COUNTER_TYPES: CounterType[] = [
  { key: "lancamento", label: "Lançamentos", icon: <Clock className="h-4 w-4" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { key: "meta", label: "Metas", icon: <Target className="h-4 w-4" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { key: "meta_ajuste", label: "Ajustes", icon: <BarChart3 className="h-4 w-4" />, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { key: "role_gerente", label: "Por Gerentes", icon: <Users className="h-4 w-4" />, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { key: "role_admin", label: "Por Admins", icon: <Shield className="h-4 w-4" />, color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
  { key: "delete", label: "Exclusões", icon: <Trash2 className="h-4 w-4" />, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

export function AuditLogManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("7days");
  const [actionFilter, setActionFilter] = useState("all");
  const [lojaFilter, setLojaFilter] = useState("all");
  const [gerenteFilter, setGerenteFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [periodSelectOpen, setPeriodSelectOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const loadingRef = useRef({ loaded: 0, total: 0 });
  
  // Estados para cancelamento de carregamento
  const [previousPeriod, setPreviousPeriod] = useState<string>("7days");
  const [previousDateRange, setPreviousDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isMaster = user?.id === MASTER_ADMIN_ID;

  const PAGE_SIZE = 1000;

  // Buscar logs do banco com paginação automática para "Todos"
  const { data: logs = [], isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", period, actionFilter, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      // Função auxiliar para construir query base com filtros
      const buildBaseQuery = () => {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }); // Ordenação estável para paginação

        // Filtro por período
        if (period === "custom" && dateRange?.from) {
          query = query.gte("created_at", dateRange.from.toISOString());
          if (dateRange.to) {
            const endOfDay = new Date(dateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.lte("created_at", endOfDay.toISOString());
          }
        } else if (period !== "all" && period !== "custom") {
          const now = new Date();
          let startDate: Date;

          switch (period) {
            case "today":
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case "7days":
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case "30days":
              startDate = new Date(now.setDate(now.getDate() - 30));
              break;
            default:
              startDate = new Date(0);
          }

          query = query.gte("created_at", startDate.toISOString());
        }

        // Filtro por ação
        if (actionFilter !== "all") {
          query = query.eq("action", actionFilter);
        }

        return query;
      };

      // Para "Todos" ou "Personalizado", usar paginação para buscar todos os registros
      if (period === "all" || period === "custom") {
        // Criar novo AbortController para esta requisição
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        // Primeiro: buscar contagem total
        const countQuery = supabase
          .from("audit_logs")
          .select("id", { count: "exact", head: true });

        // Aplicar mesmos filtros de período na contagem
        if (period === "custom" && dateRange?.from) {
          countQuery.gte("created_at", dateRange.from.toISOString());
          if (dateRange.to) {
            const endOfDay = new Date(dateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            countQuery.lte("created_at", endOfDay.toISOString());
          }
        }

        if (actionFilter !== "all") {
          countQuery.eq("action", actionFilter);
        }

        const { count } = await countQuery;
        const totalCount = count || 0;

        loadingRef.current = { loaded: 0, total: totalCount };
        setLoadingProgress({ loaded: 0, total: totalCount });

        const allLogs: AuditLog[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          // Verificar se a requisição foi cancelada
          if (controller.signal.aborted) {
            throw new Error("Cancelled");
          }
          
          const query = buildBaseQuery().range(from, from + PAGE_SIZE - 1);
          const { data, error } = await query;

          if (error) throw error;

          if (data && data.length > 0) {
            allLogs.push(...(data as AuditLog[]));
            from += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;

            // Atualizar progresso
            loadingRef.current.loaded = allLogs.length;
            setLoadingProgress({ loaded: allLogs.length, total: totalCount });
          } else {
            hasMore = false;
          }
        }

        return allLogs;
      }

      // Para períodos curtos, usar limite simples
      const query = buildBaseQuery().limit(PAGE_SIZE);
      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Mostrar modal de loading para "Todos" ou "Personalizado" com muitos registros
  useEffect(() => {
    const isLongQuery = period === "all" || (period === "custom" && dateRange?.from);
    
    if (isLongQuery && isFetching) {
      // Só mostrar o modal se o total estimado for significativo (> 100 registros)
      // ou se ainda não sabemos o total (modal começa mostrando "Calculando...")
      if (loadingProgress.total === 0 || loadingProgress.total > 100) {
        setShowLoadingModal(true);
      } else {
        setShowLoadingModal(false);
      }
    } else {
      setShowLoadingModal(false);
    }
  }, [period, isFetching, dateRange, loadingProgress.total]);

  // Função para cancelar carregamento
  const handleCancelLoading = useCallback(() => {
    // Abortar a requisição atual
    abortControllerRef.current?.abort();
    
    // Restaurar período anterior
    setPeriod(previousPeriod);
    setDateRange(previousDateRange);
    setShowLoadingModal(false);
    setLoadingProgress({ loaded: 0, total: 0 });
  }, [previousPeriod, previousDateRange]);

  const { data: alertSettings } = useQuery({
    queryKey: ["audit-alert-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_alert_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Buscar admins para configuração de alertas
  const { data: admins = [] } = useQuery({
    queryKey: ["admins-for-alerts"],
    queryFn: async () => {
    const { data, error } = await supabase.functions.invoke("list-admins");
    if (error) throw error;
    // A edge function retorna { admins: [...] }, extrair o array
    return data?.admins || [];
    },
    enabled: alertDialogOpen,
  });

  // Mutation para salvar configurações de alerta
  const saveAlertSettings = useMutation({
    mutationFn: async (settings: { ativo: boolean; emails: string[]; acoes_monitoradas: string[] }) => {
      const { error } = await supabase
        .from("audit_alert_settings")
        .update({
          ativo: settings.ativo,
          emails: settings.emails,
          acoes_monitoradas: settings.acoes_monitoradas,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alertSettings?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-alert-settings"] });
      toast.success("Configurações de alerta salvas!");
      setAlertDialogOpen(false);
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  // Buscar lista de gerentes do banco
  const { data: gerentes = [] } = useQuery({
    queryKey: ["gerentes-for-filter"],
    queryFn: async () => {
      // Buscar user_ids que são gerentes
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "gerente");

      if (rolesError) throw rolesError;

      const gerenteIds = roles?.map((r) => r.user_id) || [];
      if (gerenteIds.length === 0) return [];

      // Buscar profiles desses gerentes
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", gerenteIds)
        .order("nome");

      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });

  // Buscar lista de admins do banco
  const { data: adminsList = [] } = useQuery({
    queryKey: ["admins-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-admins");
      if (error) throw error;
      return data?.admins || [];
    },
  });

  // Extrair lojas únicas dos logs (apenas de lançamentos e metas)
  const lojasUnicas = useMemo(() => {
    const lojas = new Set<string>();
    logs.forEach((log) => {
      // Extrair lojas APENAS de lançamentos, metas e ajustes de meta
      if ((log.entity === "lancamento" || log.entity === "meta" || log.entity === "meta_ajuste") && log.entity_name) {
        const lojaNome = log.entity_name.split(" - ")[0].trim();
        if (lojaNome && lojaNome.length > 2) lojas.add(lojaNome);
      }
    });
    return Array.from(lojas).sort();
  }, [logs]);

  // Contadores por tipo
  const contadores = useMemo(() => {
    const counts: Record<string, number> = {
      total: logs.length,
      lancamento: 0,
      meta: 0,
      meta_ajuste: 0,
      role_gerente: 0,
      role_admin: 0,
      delete: 0,
    };

    logs.forEach((log) => {
      // Contagem por entidade
      if (log.entity === "lancamento") counts.lancamento++;
      if (log.entity === "meta") counts.meta++;
      if (log.entity === "meta_ajuste") counts.meta_ajuste++;

      // Contagem por role do usuário
      if (log.user_role === "gerente") counts.role_gerente++;
      if (log.user_role === "admin") counts.role_admin++;

      // Contagem por ação (exclusões)
      if (log.action === "delete") counts.delete++;
    });

    return counts;
  }, [logs]);

  // Filtrar logs no frontend
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro por tipo (cards)
      if (tipoSelecionado) {
        // Cards de role filtram por user_role
        if (tipoSelecionado === "role_gerente" && log.user_role !== "gerente") return false;
        if (tipoSelecionado === "role_admin" && log.user_role !== "admin") return false;
        // Card de exclusões filtra por action
        if (tipoSelecionado === "delete" && log.action !== "delete") return false;
        // Cards de entidade filtram por entity
        if (!["role_gerente", "role_admin", "delete"].includes(tipoSelecionado) && log.entity !== tipoSelecionado) return false;
      }

      // Filtro por loja (aplicar apenas em lançamentos, metas e ajustes)
      if (lojaFilter !== "all") {
        if (log.entity === "lancamento" || log.entity === "meta" || log.entity === "meta_ajuste") {
          const lojaNome = log.entity_name?.split(" - ")[0]?.trim() || "";
          if (lojaNome !== lojaFilter) return false;
        } else {
          // Para outras entidades, verificar se há loja nos details
          const lojaDetails = (log.details as Record<string, unknown>)?.loja_nome || (log.details as Record<string, unknown>)?.loja;
          if (!lojaDetails || !String(lojaDetails).includes(lojaFilter)) return false;
        }
      }

      // Filtro por gerente
      if (gerenteFilter !== "all") {
        if (log.user_role !== "gerente" || log.user_nome !== gerenteFilter) return false;
      }

      // Filtro por admin
      if (adminFilter !== "all") {
        if (log.user_role !== "admin" || log.user_nome !== adminFilter) return false;
      }

      // Filtro por busca textual
      if (searchTerm.trim()) {
        const termo = searchTerm.toLowerCase();
        const matchNome = log.entity_name?.toLowerCase().includes(termo);
        const matchUsuario = log.user_nome.toLowerCase().includes(termo);
        const matchDetalhes = JSON.stringify(log.details).toLowerCase().includes(termo);
        if (!matchNome && !matchUsuario && !matchDetalhes) return false;
      }

      return true;
    });
  }, [logs, tipoSelecionado, lojaFilter, gerenteFilter, adminFilter, searchTerm]);

  // Limpar filtros
  const handleClearFilters = () => {
    setPeriod("7days");
    setActionFilter("all");
    setLojaFilter("all");
    setGerenteFilter("all");
    setAdminFilter("all");
    setTipoSelecionado(null);
    setSearchTerm("");
    setDateRange(undefined);
  };

  const hasActiveFilters =
    period !== "7days" ||
    actionFilter !== "all" ||
    lojaFilter !== "all" ||
    gerenteFilter !== "all" ||
    adminFilter !== "all" ||
    tipoSelecionado !== null ||
    searchTerm.trim() !== "" ||
    dateRange !== undefined;

  // Exportar CSV
  const exportarCSV = () => {
    const headers = ["Data/Hora", "Usuário", "Função", "Ação", "Tipo", "Entidade", "Detalhes"];
    const rows = logsFiltrados.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      log.user_nome,
      log.user_role === "admin" ? "Administrador" : "Gerente",
      ACTION_LABELS[log.action] || log.action,
      ENTITY_LABELS[log.entity] || log.entity,
      log.entity_name || "-",
      JSON.stringify(log.details),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  // Exportar PDF
  const exportarPDF = async () => {
    let periodoLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label || period;
    if (period === "custom" && dateRange?.from && dateRange?.to) {
      periodoLabel = `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
    }
    const acaoLabel = ACTION_OPTIONS.find((a) => a.value === actionFilter)?.label || actionFilter;

    // Construir label de usuário para o PDF
    let usuarioLabel = "Todos";
    if (gerenteFilter !== "all") usuarioLabel = `${gerenteFilter} (Gerente)`;
    else if (adminFilter !== "all") usuarioLabel = `${adminFilter} (Admin)`;

    await generateAuditReport(logsFiltrados, {
      periodo: periodoLabel,
      acao: acaoLabel,
      loja: lojaFilter === "all" ? "Todas" : lojaFilter,
      usuario: usuarioLabel,
      busca: searchTerm,
    });
    toast.success("PDF exportado com sucesso!");
  };

  // Estado local para configuração de alertas
  const [alertAtivo, setAlertAtivo] = useState(false);
  const [emailsSelecionados, setEmailsSelecionados] = useState<string[]>([]);
  const [monitorarDelete, setMonitorarDelete] = useState(true);

  // Sincronizar estado local com configurações do banco
  useMemo(() => {
    if (alertSettings) {
      setAlertAtivo(alertSettings.ativo);
      setEmailsSelecionados(alertSettings.emails || []);
      setMonitorarDelete(alertSettings.acoes_monitoradas?.includes("delete") ?? true);
    }
  }, [alertSettings]);

  const toggleEmail = (email: string, checked: boolean) => {
    if (checked) {
      setEmailsSelecionados((prev) => [...prev, email]);
    } else {
      setEmailsSelecionados((prev) => prev.filter((e) => e !== email));
    }
  };

  const handleSaveAlertSettings = () => {
    const acoes = [];
    if (monitorarDelete) acoes.push("delete");

    saveAlertSettings.mutate({
      ativo: alertAtivo,
      emails: emailsSelecionados,
      acoes_monitoradas: acoes,
    });
  };

  return (
    <>
      {/* Modal de Loading para "Todos" com progresso */}
      {showLoadingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop com blur */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-modal-fade-in" />
          
          {/* Card central */}
          <div className="relative z-10 bg-card rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-modal-scale-in border border-border min-w-[280px]">
            {/* Spinner animado moderno */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-muted" />
              <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spinner" />
            </div>
            
            {/* Texto com progresso */}
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                {period === "custom" 
                  ? "Carregando período selecionado" 
                  : "Carregando todos os registros"}
              </p>
              {loadingProgress.total > 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {loadingProgress.loaded.toLocaleString("pt-BR")} de {loadingProgress.total.toLocaleString("pt-BR")} registros...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Calculando total...
                </p>
              )}
            </div>

            {/* Barra de progresso */}
            {loadingProgress.total > 0 && (
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min((loadingProgress.loaded / loadingProgress.total) * 100, 100)}%` }}
                />
              </div>
            )}
            
            {/* Botão de Cancelar */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelLoading}
              className="mt-2"
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Calendário para Período Personalizado - React Aria */}
      <RangeCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => {
          setCalendarModalOpen(false);
          if (!dateRange?.from) setPeriod("7days");
        }}
        onApply={(range) => {
          setDateRange(range);
          setCalendarModalOpen(false);
        }}
        initialRange={dateRange}
        maxDate={new Date()}
      />

    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                {isMaster ? "Log Master" : "Log de Auditoria"}
              </h3>
              {isMaster && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                  <Crown className="h-3 w-3" />
                  Master
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isMaster
                ? "Visualização completa de todas as operações do sistema"
                : "Registro de alterações realizadas por administradores e gerentes"}
            </p>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex items-center gap-2">
          {/* Config Alertas */}
          <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Alertas</span>
                {alertSettings?.ativo && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar Alertas por Email</DialogTitle>
                <DialogDescription>
                  Receba notificações automáticas quando ações críticas forem detectadas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="alert-ativo" className="text-base">Alertas ativos</Label>
                  <Switch
                    id="alert-ativo"
                    checked={alertAtivo}
                    onCheckedChange={setAlertAtivo}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Administradores que receberão alertas</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {admins.map((admin: { id: string; nome: string; email: string }) => (
                      <div key={admin.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <Checkbox
                          id={admin.id}
                          checked={emailsSelecionados.includes(admin.email)}
                          onCheckedChange={(checked) => toggleEmail(admin.email, !!checked)}
                        />
                        <label htmlFor={admin.id} className="flex-1 cursor-pointer">
                          <div className="font-medium text-sm">{admin.nome}</div>
                          <div className="text-xs text-muted-foreground">{admin.email}</div>
                        </label>
                      </div>
                    ))}
                    {admins.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">Carregando administradores...</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Ações monitoradas</Label>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id="monitor-delete"
                      checked={monitorarDelete}
                      onCheckedChange={(checked) => setMonitorarDelete(!!checked)}
                    />
                    <label htmlFor="monitor-delete" className="flex-1 cursor-pointer">
                      <div className="font-medium text-sm text-red-600 dark:text-red-400">Exclusões</div>
                      <div className="text-xs text-muted-foreground">
                        Alertar quando registros forem excluídos
                      </div>
                    </label>
                  </div>
                </div>

                <Button
                  onClick={handleSaveAlertSettings}
                  className="w-full"
                  disabled={saveAlertSettings.isPending}
                >
                  {saveAlertSettings.isPending ? "Salvando..." : "Salvar configurações"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportarCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {COUNTER_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() =>
              setTipoSelecionado(tipoSelecionado === type.key ? null : type.key)
            }
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
              tipoSelecionado === type.key
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50",
              type.key === "delete" && contadores[type.key] > 0 && "border-red-300 dark:border-red-800"
            )}
          >
            <div className={`p-1.5 rounded-lg ${type.color} mb-1`}>
              {type.icon}
            </div>
            <span className={cn(
              "text-lg font-bold",
              type.key === "delete" && contadores[type.key] > 0 && "text-red-600 dark:text-red-400"
            )}>
              {contadores[type.key] || 0}
            </span>
            <span className="text-xs text-muted-foreground">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-xl border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select 
          value={period} 
          open={periodSelectOpen}
          onOpenChange={setPeriodSelectOpen}
          onValueChange={(val) => {
            // Salvar período atual antes de mudar (para permitir cancelamento)
            if (val === "all" || val === "custom") {
              setPreviousPeriod(period);
              setPreviousDateRange(dateRange);
            }
            setPeriod(val);
            if (val === "custom") {
              setCalendarModalOpen(true);
            } else {
              setDateRange(undefined);
            }
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {period === "custom" && dateRange?.from && dateRange?.to 
                ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                : PERIOD_OPTIONS.find(p => p.value === period)?.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-background">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem 
                key={opt.value} 
                value={opt.value}
                onPointerDown={(e) => {
                  // Se clicar em "Personalizado" quando já está em custom,
                  // fechar o select e abrir o calendário
                  if (opt.value === "custom" && period === "custom") {
                    e.preventDefault();
                    setPeriodSelectOpen(false);
                    setTimeout(() => setCalendarModalOpen(true), 0);
                  }
                }}
                onKeyDown={(e) => {
                  // Suporte a teclado (Enter/Space)
                  if (opt.value === "custom" && period === "custom" && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setPeriodSelectOpen(false);
                    setTimeout(() => setCalendarModalOpen(true), 0);
                  }
                }}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botão para reabrir calendário quando período custom já está selecionado */}
        {period === "custom" && dateRange?.from && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCalendarModalOpen(true);
            }}
            className="text-muted-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        )}

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background">
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={lojaFilter} onValueChange={setLojaFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Todas lojas" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">Todas lojas</SelectItem>
            {lojasUnicas.map((loja) => (
              <SelectItem key={loja} value={loja}>
                {loja}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gerenteFilter} onValueChange={setGerenteFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos gerentes" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">Todos gerentes</SelectItem>
            {gerentes.map((g: { id: string; nome: string }) => (
              <SelectItem key={g.id} value={g.nome}>
                {g.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={adminFilter} onValueChange={setAdminFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Todos admins" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">Todos admins</SelectItem>
            {adminsList.map((a: { id: string; nome: string }) => (
              <SelectItem key={a.id} value={a.nome}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Busca */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground shrink-0"
          >
            Limpar
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground shrink-0">
          {logsFiltrados.length} de {logs.length}
        </div>
      </div>

      {/* Lista */}
      <AuditLogList logs={logsFiltrados} isLoading={isLoading} isMaster={isMaster} />
    </div>
    </>
  );
}
