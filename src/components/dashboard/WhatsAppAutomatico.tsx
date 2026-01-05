import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Phone, Bell, User, History, CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WhatsAppCobranca } from "./WhatsAppCobranca";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppSettings {
  id: string;
  ativo: boolean;
  horarios_ativos: string[];
  gerentes_ativos: string[]; // Agora são admin IDs
}

interface ReportLogEntry {
  id: string;
  admin_id: string;
  admin_nome: string;
  admin_telefone: string;
  data: string;
  horario_envio: string;
  template_usado: string;
  is_test: boolean;
  status: string;
  erro_detalhes: string | null;
  enviado_em: string;
  // Novos campos de rastreabilidade
  sendpulse_response: string | null;
  sendpulse_message_id: string | null;
  sendpulse_status: number | null;
}

// Lista fixa dos 3 administradores que podem receber relatórios
const ADMINISTRADORES_DESTINATARIOS = [{
  id: "ca936b16-8a15-43f4-976d-6be91e294099",
  nome: "Diogo DEV",
  telefone: "+5582981627838",
  contactId: "69322fead2b7eee6000b2336"
}, {
  id: "766164b8-23c5-490a-8409-412e8651da33",
  nome: "Thiago",
  telefone: "+5587981757169",
  contactId: "69370bb93debac0d790a7a42"
}, {
  id: "687d830b-4bad-4e39-9273-fab71f0d4bd0",
  nome: "Dyogo",
  telefone: "+5581982882100",
  contactId: "69556ee0143b1c873907e644"
}];

// Horários de envio: 40 minutos após cada horário de meta
const HORARIOS_DISPONIVEIS = [{
  value: "10:40",
  label: "10:40",
  metaRef: "10:00"
}, {
  value: "14:40",
  label: "14:40",
  metaRef: "14:00"
}, {
  value: "16:40",
  label: "16:40",
  metaRef: "16:00"
}, {
  value: "19:40",
  label: "19:40",
  metaRef: "19:00"
}, {
  value: "23:40",
  label: "23:40",
  metaRef: "23:00"
}];

export function WhatsAppAutomatico() {
  const queryClient = useQueryClient();
  const [ativo, setAtivo] = useState(false);
  const [horariosAtivos, setHorariosAtivos] = useState<string[]>([]);
  const [adminsAtivos, setAdminsAtivos] = useState<string[]>([]);
  const [isEnviandoTeste, setIsEnviandoTeste] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState("7");

  // Buscar configurações existentes
  const {
    data: settings,
    isLoading: isLoadingSettings
  } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("whatsapp_report_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as WhatsAppSettings | null;
    }
  });

  // Buscar histórico de envios
  const {
    data: historicoEnvios,
    isLoading: isLoadingHistorico
  } = useQuery({
    queryKey: ["whatsapp-report-log", filtroHistorico],
    queryFn: async () => {
      const diasAtras = parseInt(filtroHistorico);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      
      const { data, error } = await supabase
        .from("whatsapp_report_log")
        .select("*")
        .gte("enviado_em", dataLimite.toISOString())
        .order("enviado_em", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as ReportLogEntry[];
    }
  });

  // Atualizar estado local quando settings carregar
  useEffect(() => {
    if (settings) {
      setAtivo(settings.ativo);
      setHorariosAtivos(settings.horarios_ativos || []);
      setAdminsAtivos(settings.gerentes_ativos || []);
    }
  }, [settings]);

  // Mutation para salvar configurações
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ativo,
        horarios_ativos: horariosAtivos,
        gerentes_ativos: adminsAtivos
      };
      if (settings?.id) {
        const {
          error
        } = await supabase.from("whatsapp_report_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const {
          error
        } = await supabase.from("whatsapp_report_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-settings"]
      });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // Função para enviar teste
  const enviarTeste = async () => {
    if (adminsAtivos.length === 0) {
      toast.error("Selecione pelo menos um administrador para enviar o teste");
      return;
    }
    setIsEnviandoTeste(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("send-whatsapp-report", {
        body: {
          isTest: true
        }
      });
      if (error) throw error;
      if (data.success) {
        toast.success(data.message || "Teste enviado com sucesso!");
        if (data.failCount > 0) {
          toast.warning(`${data.failCount} envio(s) falharam. Verifique os logs.`);
        }
        // Atualizar histórico após envio
        queryClient.invalidateQueries({ queryKey: ["whatsapp-report-log"] });
      } else {
        toast.error(data.message || data.error || "Erro ao enviar teste");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Erro ao enviar teste:", error);
      toast.error(`Erro ao enviar teste: ${errorMessage}`);
    } finally {
      setIsEnviandoTeste(false);
    }
  };
  
  const toggleHorario = (horario: string) => {
    setHorariosAtivos(prev => prev.includes(horario) ? prev.filter(h => h !== horario) : [...prev, horario]);
  };
  
  const toggleAdmin = (adminId: string) => {
    setAdminsAtivos(prev => prev.includes(adminId) ? prev.filter(a => a !== adminId) : [...prev, adminId]);
  };
  
  if (isLoadingSettings) {
    return <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>;
  }
  
  return <Tabs defaultValue="cobrancas" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="cobrancas" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Cobranças
        </TabsTrigger>
        <TabsTrigger value="relatorios" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cobrancas">
        <WhatsAppCobranca />
      </TabsContent>

      <TabsContent value="relatorios" className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">Relatórios dos administradores</CardTitle>
                  <CardDescription>
                    Envie ranking automático para administradores via WhatsApp
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ativo ? "Ativo" : "Inativo"}
                </span>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Horários de Envio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Horários de Envio</CardTitle>
            <CardDescription>
              Relatórios são enviados 40 minutos após cada horário de meta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {HORARIOS_DISPONIVEIS.map(horario => <div key={horario.value} className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${horariosAtivos.includes(horario.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`} onClick={() => toggleHorario(horario.value)}>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={horariosAtivos.includes(horario.value)} className="pointer-events-none" />
                    <span className="font-medium">{horario.label}</span>
                  </div>
                  <span className={`text-xs ${horariosAtivos.includes(horario.value) ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    (meta {horario.metaRef})
                  </span>
                </div>)}
            </div>
          </CardContent>
        </Card>

        {/* Administradores Destinatários */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Administradores Destinatários</CardTitle>
            <CardDescription>
              Selecione quais administradores receberão os relatórios via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {ADMINISTRADORES_DESTINATARIOS.map(admin => <div key={admin.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${adminsAtivos.includes(admin.id) ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-background hover:bg-muted"}`} onClick={() => toggleAdmin(admin.id)}>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={adminsAtivos.includes(admin.id)} className="pointer-events-none" />
                    <div>
                      <p className="font-medium">{admin.nome}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {admin.telefone}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Admin
                        </span>
                      </div>
                    </div>
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="flex-1">
            {salvarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Configuração
          </Button>
          <Button variant="outline" onClick={enviarTeste} disabled={isEnviandoTeste || adminsAtivos.length === 0} className="flex-1 gap-2">
            {isEnviandoTeste ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Teste Agora
          </Button>
        </div>

        {adminsAtivos.length === 0 && <p className="text-sm text-muted-foreground text-center">
            Selecione pelo menos um administrador para habilitar o envio de teste.
          </p>}

        {/* Histórico de Envios */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Histórico de Envios</CardTitle>
                  <CardDescription>
                    Registros de relatórios enviados aos administradores
                  </CardDescription>
                </div>
              </div>
              <Select value={filtroHistorico} onValueChange={setFiltroHistorico}>
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
            {isLoadingHistorico ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historicoEnvios && historicoEnvios.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Administrador</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rastreabilidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoEnvios.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.admin_nome}</p>
                            <p className="text-xs text-muted-foreground">{log.admin_telefone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{log.horario_envio}</TableCell>
                        <TableCell>
                          {log.is_test ? (
                            <Badge variant="secondary">Teste</Badge>
                          ) : (
                            <Badge variant="outline">Automático</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.status === "enviado" ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Enviado</span>
                            </div>
                          ) : (
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
                          )}
                        </TableCell>
                        <TableCell>
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
                                      Envio para {log.admin_nome} em {format(new Date(log.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
      </TabsContent>
    </Tabs>;
}