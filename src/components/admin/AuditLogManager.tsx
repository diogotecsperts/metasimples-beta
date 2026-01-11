import { useState, useMemo } from "react";
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
  Store,
  BarChart3,
  X,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ACTION_LABELS, ENTITY_LABELS, type AuditAction, type AuditEntity } from "@/lib/auditLog";
import { generateAuditReport } from "@/lib/generateAuditReport";

const MASTER_ADMIN_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "7 dias" },
  { value: "30days", label: "30 dias" },
  { value: "all", label: "Todos" },
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
  { key: "gerente", label: "Gerentes", icon: <Users className="h-4 w-4" />, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { key: "admin", label: "Admins", icon: <Shield className="h-4 w-4" />, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { key: "loja", label: "Lojas", icon: <Store className="h-4 w-4" />, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
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

  const isMaster = user?.id === MASTER_ADMIN_ID;

  // Buscar logs do banco
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", period, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      // Filtro por período
      if (period !== "all") {
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

      // Limitar resultados
      query = query.limit(500);

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Buscar configurações de alerta
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
      gerente: 0,
      admin: 0,
      loja: 0,
    };

    logs.forEach((log) => {
      if (log.entity in counts) {
        counts[log.entity]++;
      }
    });

    return counts;
  }, [logs]);

  // Filtrar logs no frontend
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro por tipo (cards)
      if (tipoSelecionado && log.entity !== tipoSelecionado) return false;

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
  };

  const hasActiveFilters =
    period !== "7days" ||
    actionFilter !== "all" ||
    lojaFilter !== "all" ||
    gerenteFilter !== "all" ||
    adminFilter !== "all" ||
    tipoSelecionado !== null ||
    searchTerm.trim() !== "";

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
    const periodoLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label || period;
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
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
              tipoSelecionado === type.key
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className={`p-1.5 rounded-lg ${type.color} mb-1`}>
              {type.icon}
            </div>
            <span className="text-lg font-bold">{contadores[type.key] || 0}</span>
            <span className="text-xs text-muted-foreground">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-xl border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
  );
}
