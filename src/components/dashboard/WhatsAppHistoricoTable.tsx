import { format, formatDistanceToNow } from "date-fns";
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
import { History, Clock, CheckCheck, XCircle, AlertTriangle, Info, Loader2, RefreshCw, CirclePlus, CircleMinus } from "lucide-react";
import React from "react";
import { toast } from "sonner";

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
  // Novos campos para método de envio
  metodo_envio?: string | null;
  contact_id_usado?: string | null;
  telefone_usado?: string | null;
  // Campos de confirmação manual
  confirmacao_manual?: boolean;
  confirmado_manual_em?: string | null;
  // Campos que podem existir dependendo da tabela
  admin_telefone?: string;
  // Campo preenchido via JOIN (logs de cobrança)
  gerente_telefone?: string;
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
  // Callback para verificar status de mensagem
  onVerificarStatus?: (log: T) => void;
  // Estado de verificação em andamento
  verificandoStatusId?: string | null;
  // Callback para toggle de confirmação manual (marcar/desmarcar)
  onToggleConfirmacao?: (log: T) => void;
  // Estado de confirmação manual em andamento
  confirmandoManualId?: string | null;
}

// Calcula há quanto tempo o status está "Aceito"
function calcularTempoEspera(enviadoEm: string): { texto: string; minutos: number } {
  const enviado = new Date(enviadoEm);
  const agora = new Date();
  const diffMs = agora.getTime() - enviado.getTime();
  const diffMinutos = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMinutos / 60);
  
  if (diffHoras > 0) {
    return { texto: `há ${diffHoras}h ${diffMinutos % 60}m`, minutos: diffMinutos };
  }
  return { texto: `há ${diffMinutos}m`, minutos: diffMinutos };
}

// Componente de status de entrega - compartilhado (apenas visual, sem botão de confirmação)
function StatusEntregaCell({ log }: { log: LogEntryBase }) {
  const statusEntrega = log.status_entrega || (log.status === "enviado" ? "aceito" : "falhou");
  const temConfirmacaoManual = log.confirmacao_manual === true;
  
  // Status confirmado pelo webhook
  if (statusEntrega === "enviado") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-green-600 cursor-help">
                <CheckCheck className="h-4 w-4" />
                <span>Confirmado</span>
              </div>
              {temConfirmacaoManual && (
                <Badge variant="outline" className="text-xs py-0 h-5 border-blue-300 text-blue-600">
                  +Manual
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">✓ Webhook confirmou entrega ao WhatsApp</p>
            {log.webhook_recebido_em && (
              <p className="text-xs text-muted-foreground">
                Confirmado em {format(new Date(log.webhook_recebido_em), "dd/MM HH:mm:ss", { locale: ptBR })}
              </p>
            )}
            {temConfirmacaoManual && log.confirmado_manual_em && (
              <p className="text-xs text-blue-600 mt-1">
                ✓ Também confirmado manualmente em {format(new Date(log.confirmado_manual_em), "dd/MM HH:mm:ss", { locale: ptBR })}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Status aceito (aguardando webhook)
  if (statusEntrega === "aceito") {
    const { texto: tempoEspera, minutos } = calcularTempoEspera(log.enviado_em);
    const isAguardandoMuito = minutos >= 5;
    
    // Se tem confirmação manual, mostrar de forma diferente
    if (temConfirmacaoManual) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-blue-600 cursor-help">
                  <CheckCheck className="h-4 w-4" />
                  <span>Confirmado</span>
                </div>
                <Badge variant="outline" className="text-xs py-0 h-5 border-blue-300 text-blue-600">
                  Manual
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium">✓ Confirmado manualmente por você</p>
              {log.confirmado_manual_em && (
                <p className="text-xs text-muted-foreground">
                  Em {format(new Date(log.confirmado_manual_em), "dd/MM HH:mm:ss", { locale: ptBR })}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Webhook ainda não retornou confirmação automática
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 cursor-help ${isAguardandoMuito ? 'text-orange-600' : 'text-yellow-600'}`}>
              <Clock className="h-4 w-4" />
              <span>Aceito</span>
              {isAguardandoMuito && (
                <AlertTriangle className="h-3 w-3" />
              )}
              <span className="text-xs opacity-70">({tempoEspera})</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">Aguardando confirmação do WhatsApp</p>
            <p className="text-xs text-muted-foreground">Enviado {tempoEspera}</p>
            <p className="text-xs mt-1">
              O webhook de confirmação ainda não retornou.
              {isAguardandoMuito && " Isso pode indicar problema de entrega ou número inválido."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Status falhou
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

// Componente de via de envio - mostra se foi por telefone ou contact_id
function ViaEnvioCell({ log }: { log: LogEntryBase }) {
  const isContactId = log.metodo_envio === 'contact_id';
  
  // Determinar o valor a exibir com prioridade clara
  let valorExibido = '';
  let tipoExibido: 'phone' | 'contact_id' = 'phone';
  
  if (isContactId && log.contact_id_usado) {
    // Foi explicitamente enviado via contact_id
    valorExibido = log.contact_id_usado;
    tipoExibido = 'contact_id';
  } else if (log.telefone_usado) {
    // Telefone foi registrado no envio
    valorExibido = log.telefone_usado;
  } else if (log.admin_telefone) {
    // Fallback: logs de relatório têm admin_telefone
    valorExibido = log.admin_telefone;
  } else if (log.gerente_telefone) {
    // Fallback: logs de cobrança com JOIN do gerente
    valorExibido = log.gerente_telefone;
  }
  // NÃO extraímos contact_id da resposta SendPulse para evitar confusão

  if (!valorExibido) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-help px-2.5">—</Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Dados de envio não disponíveis</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isContactIdDisplay = tipoExibido === 'contact_id';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={isContactIdDisplay ? "secondary" : "outline"}
            className="cursor-pointer text-xs hover:bg-muted font-mono px-2.5"
            onClick={async () => {
              await navigator.clipboard.writeText(valorExibido);
              toast.success("Copiado!");
            }}
          >
            {isContactIdDisplay ? "🆔 " : "📱 "}
            {valorExibido}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isContactIdDisplay ? "Enviado via Contact ID (fallback)" : "Enviado via Telefone"}</p>
          <p className="text-xs text-muted-foreground">Clique para copiar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente de rastreabilidade - mantém o botão "i" para detalhes
function RastreabilidadeCell({ 
  log, 
  destinatarioNome,
  onVerificarStatus,
  isVerificando
}: { 
  log: LogEntryBase; 
  destinatarioNome: string;
  onVerificarStatus?: () => void;
  isVerificando?: boolean;
}) {
  const statusEntrega = log.status_entrega || (log.status === "enviado" ? "aceito" : "falhou");
  const podeVerificar = statusEntrega === 'aceito' && log.sendpulse_message_id && onVerificarStatus;
  
  return (
    <div className="flex items-center gap-2">
      
      {log.sendpulse_status && (
        <Badge 
          variant={log.sendpulse_status === 200 ? "default" : "destructive"} 
          className="text-xs"
        >
          HTTP {log.sendpulse_status}
        </Badge>
      )}
      
      {/* Botão Verificar Status - aparece para logs "Aceito" com message_id */}
      {podeVerificar && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={onVerificarStatus}
                disabled={isVerificando}
              >
                {isVerificando ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Verificar status real na API</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
                <code className="text-xs bg-muted p-2 rounded block break-all">
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
              <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
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

// Componente para confirmação manual - coluna separada no final da tabela
function ConfirmacaoManualCell({ 
  log, 
  onToggleConfirmacao,
  isProcessando 
}: { 
  log: LogEntryBase;
  onToggleConfirmacao: () => void;
  isProcessando?: boolean;
}) {
  const confirmado = log.confirmacao_manual === true;
  
  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Selo visual dos dois vistos - só aparece se confirmado */}
      {confirmado && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-blue-500">
                <CheckCheck className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Confirmado manualmente</p>
              {log.confirmado_manual_em && (
                <p className="text-xs text-muted-foreground">
                  Em {format(new Date(log.confirmado_manual_em), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Botão para marcar/desmarcar */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-6 w-6 p-0 ${confirmado ? 'text-blue-500 hover:text-red-500' : 'text-muted-foreground hover:text-blue-500'}`}
              onClick={onToggleConfirmacao}
              disabled={isProcessando}
            >
              {isProcessando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : confirmado ? (
                <CircleMinus className="h-3.5 w-3.5" />
              ) : (
                <CirclePlus className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{confirmado ? "Desmarcar confirmação manual" : "Marcar como confirmado"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
  getDestinatarioNome = () => "Destinatário",
  onVerificarStatus,
  verificandoStatusId,
  onToggleConfirmacao,
  confirmandoManualId
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
                  <TableHead>Via Envio</TableHead>
                  <TableHead>Detalhes</TableHead>
                  {onToggleConfirmacao && <TableHead className="w-[70px] text-right">Manual</TableHead>}
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
                      <ViaEnvioCell log={log} />
                    </TableCell>
                    <TableCell>
                      <RastreabilidadeCell 
                        log={log} 
                        destinatarioNome={getDestinatarioNome(log)}
                        onVerificarStatus={onVerificarStatus ? () => onVerificarStatus(log) : undefined}
                        isVerificando={verificandoStatusId === log.id}
                      />
                    </TableCell>
                    {onToggleConfirmacao && (
                      <TableCell className="text-right">
                        <ConfirmacaoManualCell 
                          log={log}
                          onToggleConfirmacao={() => onToggleConfirmacao(log)}
                          isProcessando={confirmandoManualId === log.id}
                        />
                      </TableCell>
                    )}
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
