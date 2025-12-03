import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuditLogList, type AuditLog } from "./AuditLogList";
import { ScrollText, Crown, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AuditAction, AuditEntity } from "@/lib/auditLog";

const MASTER_ADMIN_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "all", label: "Todos" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "Todas as ações" },
  { value: "create", label: "Criações" },
  { value: "update", label: "Edições" },
  { value: "delete", label: "Exclusões" },
];

const ENTITY_OPTIONS = [
  { value: "all", label: "Todas as entidades" },
  { value: "loja", label: "Lojas" },
  { value: "gerente", label: "Gerentes" },
  { value: "meta", label: "Metas" },
  { value: "admin", label: "Administradores" },
  { value: "lancamento", label: "Lançamentos" },
];

export function AuditLogManager() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("7days");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const isMaster = user?.id === MASTER_ADMIN_ID;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", period, actionFilter, entityFilter],
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

      // Filtro por entidade
      if (entityFilter !== "all") {
        query = query.eq("entity", entityFilter);
      }

      // Limitar resultados
      query = query.limit(200);

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const handleClearFilters = () => {
    setPeriod("7days");
    setActionFilter("all");
    setEntityFilter("all");
  };

  const hasActiveFilters =
    period !== "7days" || actionFilter !== "all" || entityFilter !== "all";

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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-xl border">
        <Filter className="h-4 w-4 text-muted-foreground" />

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]">
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
          <SelectTrigger className="w-[150px]">
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

        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background">
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {logs.length} registro{logs.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* List */}
      <AuditLogList logs={logs} isLoading={isLoading} isMaster={isMaster} />
    </div>
  );
}
