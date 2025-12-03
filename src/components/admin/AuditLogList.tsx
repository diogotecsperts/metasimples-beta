import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Store, Users, Target, Shield, Clock } from "lucide-react";
import { ACTION_LABELS, ENTITY_LABELS, type AuditAction, type AuditEntity } from "@/lib/auditLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type AuditLog = {
  id: string;
  created_at: string;
  user_id: string;
  user_nome: string;
  user_role: string;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown>;
};

type AuditLogListProps = {
  logs: AuditLog[];
  isLoading: boolean;
  isMaster: boolean;
};

const getActionIcon = (action: AuditAction) => {
  switch (action) {
    case "create":
      return <Plus className="h-4 w-4" />;
    case "update":
      return <Pencil className="h-4 w-4" />;
    case "delete":
      return <Trash2 className="h-4 w-4" />;
  }
};

const getActionColor = (action: AuditAction) => {
  switch (action) {
    case "create":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "update":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
};

const getEntityIcon = (entity: AuditEntity) => {
  switch (entity) {
    case "loja":
      return <Store className="h-4 w-4" />;
    case "gerente":
      return <Users className="h-4 w-4" />;
    case "meta":
      return <Target className="h-4 w-4" />;
    case "admin":
      return <Shield className="h-4 w-4" />;
    case "lancamento":
      return <Clock className="h-4 w-4" />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-primary/10 text-primary";
    case "gerente":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function AuditLogList({ logs, isLoading, isMaster }: AuditLogListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/20">
        <p>Nenhum registro de auditoria encontrado.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <Accordion type="multiple" className="space-y-2">
        {logs.map((log) => (
          <AccordionItem
            key={log.id}
            value={log.id}
            className="border rounded-xl bg-card shadow-sm px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-start gap-3 w-full text-left">
                {/* Action Icon */}
                <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{log.user_nome}</span>
                    <Badge variant="outline" className={getRoleColor(log.user_role)}>
                      {log.user_role === "admin" ? "Admin" : "Gerente"}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">{ACTION_LABELS[log.action]}</span>{" "}
                    <span className="inline-flex items-center gap-1">
                      {getEntityIcon(log.entity)}
                      {ENTITY_LABELS[log.entity]}
                    </span>
                    {log.entity_name && (
                      <span className="font-medium"> "{log.entity_name}"</span>
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-4">
              {Object.keys(log.details).length > 0 ? (
                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Detalhes da operação:
                  </p>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  Nenhum detalhe adicional registrado.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
}
