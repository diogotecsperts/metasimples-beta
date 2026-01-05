import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, Clock, CheckCheck, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import React from "react";

// Interface genérica para logs - campos comuns a ambas as tabelas
export interface LogEntryBase {
  id: string;
  enviado_em: string;
  status: string;
  status_entrega: string | null;
  webhook_recebido_em: string | null;
  webhook_payload: string | null;
  sendpulse_response: string | null;
  sendpulse_message_id: string | null;
  sendpulse_status: number | null;
  erro_detalhes: string | null;
}

interface WhatsAppHistoricoTableProps<T extends LogEntryBase> {
  logs: T[];
  isLoading: boolean;
  filtroHistorico: string;
  onFiltroChange: (value: string) => void;
  // Função para renderizar a célula do destinatário (admin ou gerente)
  renderDestinatario: (log: T) => React.ReactNode;
  // Função opcional para renderizar colunas extras específicas
  renderColunasExtras?: (log: T) => React.ReactNode;
  // Headers das colunas extras
  colunasExtrasHeader?: React.ReactNode;
  // Título e descrição customizáveis
  titulo?: string;
  descricao?: string;
  // Ícone e cor do header (para diferenciar cobranças de relatórios)
  headerIcon?: React.ReactNode;
  headerBgClass?: string;
  // Nome para exibir no dialog de resposta
  getDestinatarioNome?: (log: T) => string;
}

// Componente de status de entrega - compartilhado
function StatusEntregaCell({ log }: { log: LogEntryBase }) {
  const statusEntrega = log.status_entrega || (log.status === "enviado" ? "aceito" : "falhou");
  
  switch (statusEntrega) {
    case "enviado":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-green-600 cursor-help">
                <CheckCheck className="h-4 w-4" />
                <span>Confirmado</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Webhook confirmou entrega ao WhatsApp</p>
              {log.webhook_recebido_em && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(log.webhook_recebido_em), "dd/MM HH:mm:ss", { locale: ptBR })}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "aceito":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-yellow-600 cursor-help">
                <Clock className="h-4 w-4" />
                <span>Aceito</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>SendPulse aceitou, aguardando confirmação do WhatsApp</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "falhou":
    default:
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-red-600 cursor-help">
                <XCircle className="h-4 w-4" />
                <span>Falhou</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{log.erro_detalhes || "Erro desconhecido"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
  }
}

// Componente de rastreabilidade - compartilhado
function RastreabilidadeCell({ log, destinatarioNome }: { log: LogEntryBase; destinatarioNome: string }) {
  return (
    <div className="flex items-center gap-2">
      {log.sendpulse_message_id ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help text-xs">
                ID: {log.sendpulse_message_id.substring(0, 8)}...
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">{log.sendpulse_message_id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Badge variant="secondary" className="text-xs">Sem ID</Badge>
      )}
      
      {log.sendpulse_status && (
        <Badge 
          variant={log.sendpulse_status === 200 ? "default" : "destructive"} 
          className="text-xs"
        >
          HTTP {log.sendpulse_status}
        </Badge>
      )}
      
      {log.sendpulse_response && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Info className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Resposta do SendPulse</DialogTitle>
              <DialogDescription>
                Envio para {destinatarioNome} em {format(new Date(log.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Message ID:</p>
                <code className="text-xs bg-muted p-2 rounded block">
                  {log.sendpulse_message_id || "N/A"}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">HTTP Status:</p>
                <Badge variant={log.sendpulse_status === 200 ? "default" : "destructive"}>
                  {log.sendpulse_status || "N/A"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Resposta Completa:</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(log.sendpulse_response || "{}"), null, 2);
                    } catch {
                      return log.sendpulse_response || "N/A";
                    }
                  })()}
                </pre>
              </div>
              {log.webhook_payload && (
                <div>
                  <p className="text-sm font-medium mb-1">Webhook Payload:</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(log.webhook_payload || "{}"), null, 2);
                      } catch {
                        return log.webhook_payload || "N/A";
                      }
                    })()}
                  </pre>
                </div>
              )}
              {log.erro_detalhes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-destructive">Erro:</p>
                  <code className="text-xs bg-destructive/10 text-destructive p-2 rounded block">
                    {log.erro_detalhes}
                  </code>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {!log.sendpulse_response && !log.sendpulse_message_id && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Envio anterior à rastreabilidade</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export function WhatsAppHistoricoTable<T extends LogEntryBase>({
  logs,
  isLoading,
  filtroHistorico,
  onFiltroChange,
  renderDestinatario,
  renderColunasExtras,
  colunasExtrasHeader,
  titulo = "Histórico de Envios",
  descricao = "Registros de mensagens enviadas",
  headerIcon,
  headerBgClass = "bg-blue-100 dark:bg-blue-900",
  getDestinatarioNome = () => "Destinatário"
}: WhatsAppHistoricoTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${headerBgClass} rounded-lg`}>
              {headerIcon || <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            </div>
            <div>
              <CardTitle className="text-lg">{titulo}</CardTitle>
              <CardDescription>{descricao}</CardDescription>
            </div>
          </div>
          <Select value={filtroHistorico} onValueChange={onFiltroChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Destinatário</TableHead>
                  {colunasExtrasHeader}
                  <TableHead>Status Entrega</TableHead>
                  <TableHead>Rastreabilidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {renderDestinatario(log)}
                    </TableCell>
                    {renderColunasExtras && renderColunasExtras(log)}
                    <TableCell>
                      <StatusEntregaCell log={log} />
                    </TableCell>
                    <TableCell>
                      <RastreabilidadeCell 
                        log={log} 
                        destinatarioNome={getDestinatarioNome(log)} 
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum envio registrado no período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
