// Force rebuild v2 - hooks fix applied
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableHead } from "@/components/ui/table";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Phone, Bell, User, History, Settings, ChevronsUpDown, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WhatsAppCobranca } from "./WhatsAppCobranca";
import { WhatsAppHistoricoTable, LogEntryBase } from "./WhatsAppHistoricoTable";
import { WhatsAppEstatisticas } from "./WhatsAppEstatisticas";
import { cn } from "@/lib/utils";

interface WhatsAppSettings {
  id: string;
  ativo: boolean;
  horarios_ativos: string[];
  gerentes_ativos: string[]; // Agora são admin IDs
}

interface ReportLogEntry extends LogEntryBase {
  admin_id: string;
  admin_nome: string;
  admin_telefone: string;
  data: string;
  horario_envio: string;
  template_usado: string;
  is_test: boolean;
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
  // Estados para envio manual
  const [isEnviandoManual, setIsEnviandoManual] = useState(false);
  const [metodoManualAtivo, setMetodoManualAtivo] = useState<'phone' | 'contact_id' | null>(null);
  // Estado para verificação de status
  const [verificandoStatusId, setVerificandoStatusId] = useState<string | null>(null);
  // Estado para confirmação manual
  const [confirmandoManualId, setConfirmandoManualId] = useState<string | null>(null);
  // Estado para expandir/minimizar lista de admins
  const [listaAdminsExpandida, setListaAdminsExpandida] = useState(false);

  // Buscar configurações existentes
  const {
    data: settings,
    isLoading: isLoadingSettings
  } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_report_settings").select("*").limit(1).maybeSingle();
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

  // Realtime: escutar mudanças na tabela de logs para atualizar status automaticamente
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-report-log-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_report_log'
        },
        (payload) => {
          console.log('[Realtime] Report log atualizado:', payload);
          queryClient.invalidateQueries({ queryKey: ["whatsapp-report-log"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutation para salvar configurações
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ativo,
        horarios_ativos: horariosAtivos,
        gerentes_ativos: adminsAtivos
      };
      if (settings?.id) {
        const { error } = await supabase.from("whatsapp_report_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_report_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // Função para enviar teste (lógica automática)
  const enviarTeste = async () => {
    if (adminsAtivos.length === 0) {
      toast.error("Selecione pelo menos um administrador para enviar o teste");
      return;
    }
    setIsEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-report", {
        body: { isTest: true, adminsParaTeste: adminsAtivos }
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

  // Função para envio manual forçando método específico
  const enviarTesteManual = async (metodo: 'phone' | 'contact_id') => {
    if (adminsAtivos.length === 0) {
      toast.error("Selecione pelo menos um administrador");
      return;
    }
    
    setIsEnviandoManual(true);
    setMetodoManualAtivo(metodo);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-report", {
        body: { 
          isTest: true, 
          adminsParaTeste: adminsAtivos,
          metodoForcar: metodo
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Teste enviado via ${metodo === 'phone' ? 'telefone' : 'contact ID'}!`);
        if (data.failCount > 0) {
          toast.warning(`${data.failCount} envio(s) falharam.`);
        }
        queryClient.invalidateQueries({ queryKey: ["whatsapp-report-log"] });
      } else {
        toast.error(data.message || "Erro no envio");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setIsEnviandoManual(false);
      setMetodoManualAtivo(null);
    }
  };

  // Função para verificar status de mensagem via API
  const verificarStatusMensagem = async (log: ReportLogEntry) => {
    if (!log.sendpulse_message_id) {
      toast.error("Message ID não disponível");
      return;
    }
    
    setVerificandoStatusId(log.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("check-message-status", {
        body: { 
          messageId: log.sendpulse_message_id, 
          contactId: log.contact_id_usado,
          logId: log.id,
          logTable: 'report'
        }
      });
      
      if (error) throw error;
      
      if (data.found) {
        if (data.delivered) {
          toast.success(`Status: ${data.status} - Entrega confirmada!`);
          queryClient.invalidateQueries({ queryKey: ["whatsapp-report-log"] });
        } else {
          toast.info(`Status: ${data.status}`);
        }
      } else {
        toast.warning(data.message || "Mensagem não encontrada no histórico do SendPulse");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao verificar: ${errorMessage}`);
    } finally {
      setVerificandoStatusId(null);
    }
  };

  // Função para toggle de confirmação manual (marcar/desmarcar)
  const toggleConfirmacaoManual = async (log: ReportLogEntry) => {
    const novoValor = !log.confirmacao_manual;
    setConfirmandoManualId(log.id);
    
    try {
      const { error } = await supabase
        .from("whatsapp_report_log")
        .update({
          confirmacao_manual: novoValor,
          confirmado_manual_em: novoValor ? new Date().toISOString() : null
        })
        .eq("id", log.id);
      
      if (error) throw error;
      
      toast.success(novoValor ? "Confirmado manualmente" : "Confirmação removida");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-report-log"] });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setConfirmandoManualId(null);
    }
  };
  
  const toggleHorario = (horario: string) => {
    setHorariosAtivos(prev => prev.includes(horario) ? prev.filter(h => h !== horario) : [...prev, horario]);
  };
  
  const toggleAdmin = (adminId: string) => {
    setAdminsAtivos(prev => prev.includes(adminId) ? prev.filter(a => a !== adminId) : [...prev, adminId]);
  };
  
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  const adminsVisiveis = listaAdminsExpandida || ADMINISTRADORES_DESTINATARIOS.length <= 3
    ? ADMINISTRADORES_DESTINATARIOS 
    : ADMINISTRADORES_DESTINATARIOS.slice(0, 3);
  const adminsOcultos = ADMINISTRADORES_DESTINATARIOS.length - 3;
  const podeMinimigarAdmins = ADMINISTRADORES_DESTINATARIOS.length > 3;
  
  return (
    <Tabs defaultValue="cobrancas" className="space-y-6">
      <TooltipProvider>
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="cobrancas" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border dark:data-[state=active]:bg-zinc-800">
                <Bell className="h-4 w-4" />
                Cobranças
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Lembretes automáticos para gerentes que não preencheram a meta diária</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="relatorios" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border dark:data-[state=active]:bg-zinc-800">
                <MessageSquare className="h-4 w-4" />
                Relatórios
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Envio do ranking de vendas via WhatsApp para administradores</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="estatisticas" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border dark:data-[state=active]:bg-zinc-800">
                <TrendingUp className="h-4 w-4" />
                Estatísticas
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Métricas e análises de desempenho dos envios de WhatsApp</p>
            </TooltipContent>
          </Tooltip>
        </TabsList>
      </TooltipProvider>

      <TabsContent value="cobrancas">
        <WhatsAppCobranca />
      </TabsContent>
      
      <TabsContent value="estatisticas">
        <WhatsAppEstatisticas />
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
              {HORARIOS_DISPONIVEIS.map(horario => (
                <div 
                  key={horario.value} 
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${horariosAtivos.includes(horario.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`} 
                  onClick={() => toggleHorario(horario.value)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={horariosAtivos.includes(horario.value)} className="pointer-events-none" />
                    <span className="font-medium">{horario.label}</span>
                  </div>
                  <span className={`text-xs ${horariosAtivos.includes(horario.value) ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    (meta {horario.metaRef})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Administradores Destinatários */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Administradores Destinatários</CardTitle>
                <CardDescription>
                  Selecione quais administradores receberão os relatórios via WhatsApp
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!podeMinimigarAdmins}
                className={cn("h-8 w-8 p-0", !podeMinimigarAdmins && "opacity-40 cursor-not-allowed")}
                onClick={() => setListaAdminsExpandida(!listaAdminsExpandida)}
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {adminsVisiveis.map(admin => (
                <div 
                  key={admin.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${adminsAtivos.includes(admin.id) ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-background hover:bg-muted"}`} 
                  onClick={() => toggleAdmin(admin.id)}
                >
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
                </div>
              ))}
              {!listaAdminsExpandida && adminsOcultos > 0 && (
                <button 
                  onClick={() => setListaAdminsExpandida(true)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
                >
                  e mais {adminsOcultos} administrador(es)...
                </button>
              )}
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

        {adminsAtivos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Selecione pelo menos um administrador para habilitar o envio de teste.
          </p>
        )}

        {/* Seção de Envio Manual para Depuração */}
        <Card className="border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Envio Manual (Depuração)
            </CardTitle>
            <CardDescription className="text-xs">
              Força o envio por método específico, ignorando a lógica automática de fallback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => enviarTesteManual('phone')}
                disabled={isEnviandoManual || adminsAtivos.length === 0}
                className="flex-1 gap-2"
              >
                {metodoManualAtivo === 'phone' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Forçar via Telefone
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => enviarTesteManual('contact_id')}
                disabled={isEnviandoManual || adminsAtivos.length === 0}
                className="flex-1 gap-2"
              >
                {metodoManualAtivo === 'contact_id' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                Forçar via Contact ID
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Envios - Usando componente compartilhado */}
        <WhatsAppHistoricoTable<ReportLogEntry>
          logs={historicoEnvios || []}
          isLoading={isLoadingHistorico}
          filtroHistorico={filtroHistorico}
          onFiltroChange={setFiltroHistorico}
          titulo="Histórico de Envios"
          descricao="Registros de relatórios enviados aos administradores"
          headerIcon={<History className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          headerBgClass="bg-blue-100 dark:bg-blue-900"
          renderDestinatario={(log) => (
            <div>
              <p className="font-medium">{log.admin_nome}</p>
              <p className="text-xs text-muted-foreground">{log.admin_telefone}</p>
            </div>
          )}
          colunasExtrasHeader={
            <>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
            </>
          }
          renderColunasExtras={(log) => (
            <>
              <td className="p-4 align-middle">{log.horario_envio}</td>
              <td className="p-4 align-middle">
                {log.is_test ? (
                  <Badge variant="secondary">Teste</Badge>
                ) : (
                  <Badge variant="outline">Automático</Badge>
                )}
              </td>
            </>
          )}
          getDestinatarioNome={(log) => log.admin_nome}
          onVerificarStatus={verificarStatusMensagem}
          verificandoStatusId={verificandoStatusId}
          onToggleConfirmacao={toggleConfirmacaoManual}
          confirmandoManualId={confirmandoManualId}
        />
      </TabsContent>
    </Tabs>
  );
}
