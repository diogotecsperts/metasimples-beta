import { format, formatDistanceToNow, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History, Clock, CheckCheck, XCircle, AlertTriangle, Info, Loader2, RefreshCw, CirclePlus, CircleMinus, ThumbsUp, Search, Download, FileSpreadsheet, FileText } from "lucide-react";
import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

// Helper para formatar datas de forma segura (evita crash por "Invalid time value")
function safeFormatDate(dateString: string | null | undefined, formatStr: string, fallback = "—"): string {
  if (!dateString) return fallback;
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return fallback;
    return format(date, formatStr, { locale: ptBR });
  } catch {
    return fallback;
  }
}

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

// Calcula há quanto tempo o status está "Aceito" (com proteção contra datas inválidas)
function calcularTempoEspera(enviadoEm: string): { texto: string; minutos: number } {
  try {
    const enviado = new Date(enviadoEm);
    if (!isValid(enviado)) return { texto: "—", minutos: 0 };
    
    const agora = new Date();
    const diffMs = agora.getTime() - enviado.getTime();
    const diffMinutos = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMinutos / 60);
    
    if (diffHoras > 0) {
      return { texto: `há ${diffHoras}h ${diffMinutos % 60}m`, minutos: diffMinutos };
    }
    return { texto: `há ${diffMinutos}m`, minutos: diffMinutos };
  } catch {
    return { texto: "—", minutos: 0 };
  }
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
                <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">✓ Webhook confirmou entrega ao WhatsApp</p>
            {log.webhook_recebido_em && (
              <p className="text-xs text-muted-foreground">
                Confirmado em {safeFormatDate(log.webhook_recebido_em, "dd/MM HH:mm:ss")}
              </p>
            )}
            {temConfirmacaoManual && log.confirmado_manual_em && (
              <p className="text-xs text-blue-600 mt-1">
                👍 Também confirmado manualmente em {safeFormatDate(log.confirmado_manual_em, "dd/MM HH:mm:ss")}
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
              <div className="flex items-center gap-1.5 cursor-help">
                {/* Relógio laranja permanece para indicar que era "Aceito" originalmente */}
                <Clock className="h-4 w-4 text-orange-500" />
                <div className="flex items-center gap-1 text-blue-600">
                  <CheckCheck className="h-4 w-4" />
                  <span>Confirmado</span>
                </div>
                <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium">👍 Confirmado manualmente por você</p>
              {log.confirmado_manual_em && (
                <p className="text-xs text-muted-foreground">
                  Em {safeFormatDate(log.confirmado_manual_em, "dd/MM HH:mm:ss")}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1">
                ⏱ Webhook ainda não retornou (era "Aceito")
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
                Envio para {destinatarioNome} em {safeFormatDate(log.enviado_em, "dd/MM/yyyy HH:mm")}
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
                  Em {safeFormatDate(log.confirmado_manual_em, "dd/MM HH:mm")}
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

// Componente de contadores clicáveis
function StatusCounters({ 
  contadores, 
  filtroAtivo, 
  onFiltroChange 
}: { 
  contadores: { confirmados: number; aceitos: number; falhou: number; manuais: number };
  filtroAtivo: string;
  onFiltroChange: (filtro: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onFiltroChange(filtroAtivo === "confirmado" ? "todos" : "confirmado")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          filtroAtivo === "confirmado" 
            ? "bg-green-100 text-green-800 ring-2 ring-green-500 dark:bg-green-900 dark:text-green-200" 
            : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
        )}
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Confirmado: {contadores.confirmados}
      </button>
      
      <button
        onClick={() => onFiltroChange(filtroAtivo === "aceito" ? "todos" : "aceito")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          filtroAtivo === "aceito" 
            ? "bg-orange-100 text-orange-800 ring-2 ring-orange-500 dark:bg-orange-900 dark:text-orange-200" 
            : "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900"
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        Aceito: {contadores.aceitos}
      </button>
      
      <button
        onClick={() => onFiltroChange(filtroAtivo === "falhou" ? "todos" : "falhou")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          filtroAtivo === "falhou" 
            ? "bg-red-100 text-red-800 ring-2 ring-red-500 dark:bg-red-900 dark:text-red-200" 
            : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
        )}
      >
        <XCircle className="h-3.5 w-3.5" />
        Falhou: {contadores.falhou}
      </button>
      
      <button
        onClick={() => onFiltroChange(filtroAtivo === "manual" ? "todos" : "manual")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          filtroAtivo === "manual" 
            ? "bg-blue-100 text-blue-800 ring-2 ring-blue-500 dark:bg-blue-900 dark:text-blue-200" 
            : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Manual: {contadores.manuais}
      </button>
    </div>
  );
}

// Helper para obter status normalizado
function getStatusNormalizado(log: LogEntryBase): 'confirmado' | 'aceito' | 'falhou' {
  const status = log.status_entrega || (log.status === "enviado" ? "aceito" : "falhou");
  if (status === "enviado") return "confirmado";
  if (status === "aceito") return "aceito";
  return "falhou";
}

// Helper para obter tipo de confirmação
function getTipoConfirmacao(log: LogEntryBase): string {
  const status = getStatusNormalizado(log);
  if (log.confirmacao_manual) return "Manual";
  if (status === "confirmado") return "Automática";
  return "Pendente";
}

// Funções de exportação
function exportToCSV<T extends LogEntryBase>(
  logs: T[], 
  getDestinatarioNome: (log: T) => string,
  titulo: string
) {
  const headers = ["Data/Hora", "Destinatário", "Status Entrega", "Tipo Confirmação", "Via Envio", "Webhook Recebido"];
  
  const rows = logs.map(log => {
    const statusNorm = getStatusNormalizado(log);
    const statusLabel = statusNorm === "confirmado" ? "Confirmado" : statusNorm === "aceito" ? "Aceito" : "Falhou";
    const via = log.metodo_envio === "contact_id" ? "Contact ID" : "Telefone";
    const webhook = log.webhook_recebido_em ? "Sim" : "Não";
    
    return [
      safeFormatDate(log.enviado_em, "dd/MM/yyyy HH:mm"),
      getDestinatarioNome(log),
      statusLabel,
      getTipoConfirmacao(log),
      via,
      webhook
    ];
  });

  const csvContent = [
    headers.join(";"),
    ...rows.map(row => row.join(";"))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${titulo.toLowerCase().replace(/\s/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado com sucesso!");
}

function exportToPDF<T extends LogEntryBase>(
  logs: T[], 
  getDestinatarioNome: (log: T) => string,
  titulo: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Título
  doc.setFontSize(16);
  doc.text(titulo, pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 22, { align: "center" });
  doc.text(`Total: ${logs.length} registros`, pageWidth / 2, 28, { align: "center" });
  
  // Conteúdo
  let y = 40;
  const lineHeight = 7;
  const colWidths = [35, 45, 30, 30, 30, 25];
  const headers = ["Data/Hora", "Destinatário", "Status", "Confirmação", "Via", "Webhook"];
  
  // Header da tabela
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let x = 10;
  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });
  doc.setFont("helvetica", "normal");
  y += lineHeight;
  
  // Linha separadora
  doc.line(10, y - 3, pageWidth - 10, y - 3);
  
  logs.forEach(log => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    
    const statusNorm = getStatusNormalizado(log);
    const statusLabel = statusNorm === "confirmado" ? "Confirmado" : statusNorm === "aceito" ? "Aceito" : "Falhou";
    const via = log.metodo_envio === "contact_id" ? "Contact ID" : "Telefone";
    const webhook = log.webhook_recebido_em ? "Sim" : "Não";
    const nome = getDestinatarioNome(log);
    
    const row = [
      safeFormatDate(log.enviado_em, "dd/MM HH:mm"),
      nome.length > 20 ? nome.substring(0, 18) + "..." : nome,
      statusLabel,
      getTipoConfirmacao(log),
      via,
      webhook
    ];
    
    x = 10;
    row.forEach((cell, i) => {
      doc.text(cell, x, y);
      x += colWidths[i];
    });
    y += lineHeight;
  });
  
  doc.save(`${titulo.toLowerCase().replace(/\s/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
  toast.success("PDF exportado com sucesso!");
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
// Estados internos de filtro
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroConfirmacao, setFiltroConfirmacao] = useState<string>("todas");
  const [filtroVia, setFiltroVia] = useState<string>("todas");
  const [buscaDestinatario, setBuscaDestinatario] = useState<string>("");
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);

  // Lista de destinatários únicos para autocomplete
  const destinatariosUnicos = useMemo(() => {
    const nomes = logs.map(log => getDestinatarioNome(log));
    return [...new Set(nomes)].filter(Boolean).sort();
  }, [logs, getDestinatarioNome]);

  // Contadores
  const contadores = useMemo(() => {
    const confirmados = logs.filter(l => getStatusNormalizado(l) === "confirmado").length;
    const aceitos = logs.filter(l => getStatusNormalizado(l) === "aceito" && !l.confirmacao_manual).length;
    const falhou = logs.filter(l => getStatusNormalizado(l) === "falhou").length;
    const manuais = logs.filter(l => l.confirmacao_manual).length;
    return { confirmados, aceitos, falhou, manuais };
  }, [logs]);

  // Logs filtrados
  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
      const statusNorm = getStatusNormalizado(log);
      
      // Filtro de busca por destinatário
      if (buscaDestinatario) {
        const nome = getDestinatarioNome(log).toLowerCase();
        if (!nome.includes(buscaDestinatario.toLowerCase())) return false;
      }
      
      // Filtro de status (via contador ou dropdown)
      if (filtroStatus === "confirmado" && statusNorm !== "confirmado") return false;
      if (filtroStatus === "aceito" && (statusNorm !== "aceito" || log.confirmacao_manual)) return false;
      if (filtroStatus === "falhou" && statusNorm !== "falhou") return false;
      if (filtroStatus === "manual" && !log.confirmacao_manual) return false;
      
      // Filtro de confirmação (dropdown)
      if (filtroConfirmacao === "automatica" && (statusNorm !== "confirmado" || log.confirmacao_manual)) return false;
      if (filtroConfirmacao === "manual" && !log.confirmacao_manual) return false;
      if (filtroConfirmacao === "pendente" && (statusNorm === "confirmado" || log.confirmacao_manual)) return false;
      
      // Filtro de via
      if (filtroVia === "phone" && log.metodo_envio !== "phone" && log.metodo_envio !== null) return false;
      if (filtroVia === "contact_id" && log.metodo_envio !== "contact_id") return false;
      
      return true;
    });
  }, [logs, filtroStatus, filtroConfirmacao, filtroVia, buscaDestinatario, getDestinatarioNome]);

  // Handler para atualizar filtro via contadores
  const handleCounterClick = (filtro: string) => {
    setFiltroStatus(filtro);
    // Resetar outros filtros quando usar contador
    if (filtro !== "todos") {
      setFiltroConfirmacao("todas");
    }
  };

  // Limpar todos os filtros
  const limparFiltros = () => {
    setFiltroStatus("todos");
    setFiltroConfirmacao("todas");
    setFiltroVia("todas");
    setBuscaDestinatario("");
  };

  const temFiltrosAtivos = filtroStatus !== "todos" || filtroConfirmacao !== "todas" || filtroVia !== "todas" || buscaDestinatario !== "";

  // Logs paginados
  const logsExibidos = logsFiltrados.slice(0, registrosPorPagina);

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
          <div className="flex items-center gap-2">
            {/* Botão de exportação */}
            {logs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToCSV(logsFiltrados, getDestinatarioNome, titulo)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF(logsFiltrados, getDestinatarioNome, titulo)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
        </div>
      </CardHeader>
      <CardContent>
        {/* Contadores clicáveis */}
        {logs.length > 0 && (
          <StatusCounters 
            contadores={contadores} 
            filtroAtivo={filtroStatus} 
            onFiltroChange={handleCounterClick}
          />
        )}

        {/* Filtros adicionais */}
        {logs.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center mb-4">
            {/* Campo de busca por destinatário */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar destinatário..."
                value={buscaDestinatario}
                onChange={(e) => setBuscaDestinatario(e.target.value)}
                list="destinatarios-list"
                className="w-[200px] h-8 text-sm pl-8"
              />
              <datalist id="destinatarios-list">
                {destinatariosUnicos.map(nome => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </div>

            <Select value={filtroConfirmacao} onValueChange={setFiltroConfirmacao}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue placeholder="Tipo de confirmação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Tipo de confirmação</SelectItem>
                <SelectItem value="automatica">✓ Automática</SelectItem>
                <SelectItem value="manual">👍 Manual</SelectItem>
                <SelectItem value="pendente">⏱ Sem confirmação</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filtroVia} onValueChange={setFiltroVia}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue placeholder="Via de envio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Via de envio</SelectItem>
                <SelectItem value="phone">📱 Telefone</SelectItem>
                <SelectItem value="contact_id">🆔 Contact ID</SelectItem>
              </SelectContent>
            </Select>

            {temFiltrosAtivos && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-sm text-muted-foreground"
                onClick={limparFiltros}
              >
                Limpar filtros
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">
                Mostrando {logsExibidos.length} de {logsFiltrados.length}
              </span>
              <Select value={registrosPorPagina.toString()} onValueChange={(v) => setRegistrosPorPagina(Number(v))}>
                <SelectTrigger className="w-[110px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 registros</SelectItem>
                  <SelectItem value="25">25 registros</SelectItem>
                  <SelectItem value="50">50 registros</SelectItem>
                  <SelectItem value="100">100 registros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logsFiltrados && logsFiltrados.length > 0 ? (
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
                {logsExibidos.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {safeFormatDate(log.enviado_em, "dd/MM/yyyy HH:mm")}
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
        ) : logs.length > 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum envio corresponde aos filtros aplicados</p>
            <Button variant="link" onClick={limparFiltros} className="mt-2">
              Limpar filtros
            </Button>
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
