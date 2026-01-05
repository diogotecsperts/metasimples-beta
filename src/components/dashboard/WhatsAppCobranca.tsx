import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { TableHead } from "@/components/ui/table";
import { toast } from "sonner";
import { Bell, Send, Loader2, Phone, Store, Clock, AlertTriangle, History } from "lucide-react";
import { WhatsAppHistoricoTable, LogEntryBase } from "./WhatsAppHistoricoTable";

interface Gerente {
  id: string;
  nome: string;
  telefone: string | null;
  loja_id: string | null;
  loja?: {
    nome: string;
  } | null;
}

interface CobrancaSettings {
  id: string;
  ativo: boolean;
  tolerancia_minutos: number;
  intervalos_cobranca: string[];
  gerentes_ativos: string[];
  horarios_monitorados: string[];
}

interface CobrancaLog extends LogEntryBase {
  gerente_id: string;
  loja_id: string;
  data: string;
  horario_lancamento: string;
  minutos_atraso: number;
  nivel_cobranca: number;
  template_usado: string;
}

const HORARIOS_LANCAMENTO = [{
  value: "10:00",
  label: "10:00"
}, {
  value: "14:00",
  label: "14:00"
}, {
  value: "16:00",
  label: "16:00"
}, {
  value: "19:00",
  label: "19:00"
}, {
  value: "23:00",
  label: "23:00"
}];

const INTERVALOS_DISPONIVEIS = [{
  value: "05",
  label: "5 min"
}, {
  value: "10",
  label: "10 min"
}, {
  value: "15",
  label: "15 min"
}, {
  value: "20",
  label: "20 min"
}, {
  value: "30",
  label: "30 min"
}];

export function WhatsAppCobranca() {
  const queryClient = useQueryClient();
  const [ativo, setAtivo] = useState(false);
  const [toleranciaMinutos, setToleranciaMinutos] = useState(5);
  const [intervalosCobranca, setIntervalosCobranca] = useState<string[]>(["05", "15", "30"]);
  const [horariosMonitorados, setHorariosMonitorados] = useState<string[]>(["10:00", "14:00", "16:00", "19:00"]);
  const [gerentesAtivos, setGerentesAtivos] = useState<string[]>([]);
  const [isEnviandoTeste, setIsEnviandoTeste] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState("7");

  // Buscar configurações existentes
  const {
    data: settings,
    isLoading: isLoadingSettings
  } = useQuery({
    queryKey: ["whatsapp-cobranca-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_cobranca_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as CobrancaSettings | null;
    }
  });

  // Buscar logs recentes com filtro de período
  const {
    data: logs = [],
    isLoading: isLoadingLogs
  } = useQuery({
    queryKey: ["whatsapp-cobranca-logs", filtroHistorico],
    queryFn: async () => {
      const diasAtras = new Date();
      diasAtras.setDate(diasAtras.getDate() - parseInt(filtroHistorico));
      
      const { data, error } = await supabase
        .from("whatsapp_cobranca_log")
        .select("*")
        .gte("enviado_em", diasAtras.toISOString())
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data as CobrancaLog[];
    }
  });

  // Buscar lojas para exibir nomes
  const {
    data: lojas = []
  } = useQuery({
    queryKey: ["lojas-cobranca"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome");
      if (error) throw error;
      return data;
    }
  });

  // Buscar todos os gerentes com suas lojas
  const {
    data: gerentes = [],
    isLoading: isLoadingGerentes
  } = useQuery({
    queryKey: ["gerentes-cobranca"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(`
          id,
          nome,
          telefone,
          loja_id,
          user_roles!inner(role)
        `).eq("user_roles.role", "gerente");
      if (error) throw error;

      // Buscar nomes das lojas
      const lojasIds = data?.filter(g => g.loja_id).map(g => g.loja_id) || [];
      let lojasMap: Record<string, string> = {};
      if (lojasIds.length > 0) {
        const { data: lojasData } = await supabase.from("lojas").select("id, nome").in("id", lojasIds);
        if (lojasData) {
          lojasMap = Object.fromEntries(lojasData.map(l => [l.id, l.nome]));
        }
      }
      return (data || []).map(g => ({
        ...g,
        loja: g.loja_id ? {
          nome: lojasMap[g.loja_id] || "Loja não encontrada"
        } : null
      })) as Gerente[];
    }
  });

  // Atualizar estado local quando settings carregar
  useEffect(() => {
    if (settings) {
      setAtivo(settings.ativo);
      setToleranciaMinutos(settings.tolerancia_minutos);
      setIntervalosCobranca(settings.intervalos_cobranca || ["05", "15", "30"]);
      setHorariosMonitorados(settings.horarios_monitorados || ["10:00", "14:00", "16:00", "19:00"]);
      setGerentesAtivos(settings.gerentes_ativos || []);
    }
  }, [settings]);

  // Realtime: escutar mudanças na tabela de logs para atualizar status automaticamente
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-cobranca-log-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_cobranca_log'
        },
        (payload) => {
          console.log('[Realtime] Cobrança log atualizado:', payload);
          queryClient.invalidateQueries({ queryKey: ["whatsapp-cobranca-logs"] });
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
        tolerancia_minutos: toleranciaMinutos,
        intervalos_cobranca: intervalosCobranca,
        horarios_monitorados: horariosMonitorados,
        gerentes_ativos: gerentesAtivos
      };
      if (settings?.id) {
        const { error } = await supabase.from("whatsapp_cobranca_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_cobranca_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-cobranca-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // Função para enviar teste
  const enviarTeste = async () => {
    if (gerentesAtivos.length === 0) {
      toast.error("Selecione pelo menos um gerente para enviar o teste");
      return;
    }
    setIsEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-cobranca", {
        body: {
          isTest: true,
          gerenteIds: gerentesAtivos
        }
      });
      console.log("[WhatsAppCobranca] Resposta do teste:", { data, error });
      if (error) {
        console.error("[WhatsAppCobranca] Erro do invoke:", error);
        throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-cobranca-logs"] });
      if (data.success) {
        if (data.failCount > 0) {
          toast.warning(data.message, {
            description: data.results?.filter((r: { success: boolean }) => !r.success).map((r: { gerente: string; error?: string }) => `${r.gerente}: ${r.error || "Erro desconhecido"}`).join("\n"),
            duration: 8000
          });
        } else {
          toast.success(data.message || "Teste enviado com sucesso!");
        }
      } else {
        const failedResults = data.results?.filter((r: { success: boolean }) => !r.success) || [];
        if (failedResults.length > 0) {
          const detalhes = failedResults.map((r: { gerente: string; error?: string }) => `• ${r.gerente}: ${r.error || "Erro desconhecido"}`).join("\n");
          toast.error(data.message || "Nenhum teste foi enviado", {
            description: detalhes,
            duration: 10000
          });
        } else {
          toast.error(data.message || data.error || "Erro ao enviar teste");
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[WhatsAppCobranca] Erro ao enviar teste:", error);
      toast.error(`Erro ao enviar teste: ${errorMessage}`);
    } finally {
      setIsEnviandoTeste(false);
    }
  };

  const toggleHorario = (horario: string) => {
    setHorariosMonitorados(prev => prev.includes(horario) ? prev.filter(h => h !== horario) : [...prev, horario]);
  };

  const toggleIntervalo = (intervalo: string) => {
    setIntervalosCobranca(prev => {
      if (prev.includes(intervalo)) {
        if (prev.length === 1) {
          toast.error("Selecione pelo menos um intervalo de cobrança");
          return prev;
        }
        return prev.filter(i => i !== intervalo);
      }
      if (prev.length >= 3) {
        toast.error("Máximo de 3 intervalos de cobrança");
        return prev;
      }
      return [...prev, intervalo].sort((a, b) => parseInt(a) - parseInt(b));
    });
  };

  const toggleGerente = (gerenteId: string) => {
    setGerentesAtivos(prev => prev.includes(gerenteId) ? prev.filter(g => g !== gerenteId) : [...prev, gerenteId]);
  };

  const gerentesComTelefone = gerentes.filter(g => g.telefone && g.telefone.trim() !== '');
  const gerentesSemTelefone = gerentes.filter(g => !g.telefone || g.telefone.trim() === '');

  const toggleTodosGerentes = () => {
    const todosComTelefoneIds = gerentesComTelefone.map(g => g.id);
    const todosMarcados = todosComTelefoneIds.length > 0 && todosComTelefoneIds.every(id => gerentesAtivos.includes(id));
    if (todosMarcados) {
      setGerentesAtivos([]);
    } else {
      setGerentesAtivos(todosComTelefoneIds);
    }
  };

  // Mapa de gerentes e lojas para mostrar nos logs
  const gerentesMap = Object.fromEntries(gerentes.map(g => [g.id, g.nome]));
  const lojasMap = Object.fromEntries(lojas.map(l => [l.id, l.nome]));
  
  if (isLoadingSettings || isLoadingGerentes) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Cobrança dos gerentes  
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Beta
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Lembretes automáticos para gerentes que não preencheram a meta
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

      {/* Horários Monitorados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários Monitorados
          </CardTitle>
          <CardDescription>
            Horários de lançamento que serão monitorados para cobranças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {HORARIOS_LANCAMENTO.map(horario => (
              <div 
                key={horario.value} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${horariosMonitorados.includes(horario.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`} 
                onClick={() => toggleHorario(horario.value)}
              >
                <Checkbox checked={horariosMonitorados.includes(horario.value)} className="pointer-events-none" />
                <span className="font-medium">{horario.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tolerância e Intervalos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração de Cobranças</CardTitle>
          <CardDescription>
            Defina a tolerância inicial e os intervalos para envio de lembretes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tolerância */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tolerância Inicial</label>
              <span className="text-sm text-muted-foreground">
                {toleranciaMinutos} minuto{toleranciaMinutos !== 1 ? 's' : ''}
              </span>
            </div>
            <Slider value={[toleranciaMinutos]} onValueChange={value => setToleranciaMinutos(value[0])} min={0} max={30} step={1} className="w-full" />
            <p className="text-xs text-muted-foreground">
              Tempo de espera antes de iniciar as cobranças após o horário de preenchimento
            </p>
          </div>

          {/* Intervalos */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Intervalos de Cobrança (máx. 3)</label>
            <div className="flex flex-wrap gap-2">
              {INTERVALOS_DISPONIVEIS.map(intervalo => (
                <div 
                  key={intervalo.value} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-sm ${intervalosCobranca.includes(intervalo.value) ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700" : "bg-background hover:bg-muted"}`} 
                  onClick={() => toggleIntervalo(intervalo.value)}
                >
                  <Checkbox checked={intervalosCobranca.includes(intervalo.value)} className="pointer-events-none h-4 w-4" />
                  <span>{intervalo.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Exemplo: Com tolerância de 5 min e intervalos [5, 15, 30], as cobranças serão enviadas às 10:10, 10:20 e 10:35 para o horário das 10:00
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gerentes Monitorados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Gerentes Monitorados</CardTitle>
              <CardDescription>
                Selecione quais gerentes receberão lembretes de preenchimento
              </CardDescription>
            </div>
            {gerentesComTelefone.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleTodosGerentes} className="text-sm">
                {gerentesComTelefone.every(g => gerentesAtivos.includes(g.id)) ? "Desmarcar todos" : "Marcar todos"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gerentesComTelefone.length === 0 && gerentesSemTelefone.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum gerente cadastrado no sistema.
            </p>
          ) : (
            <>
              {gerentesComTelefone.length > 0 && (
                <div className="space-y-2">
                  {gerentesComTelefone.map(gerente => (
                    <div 
                      key={gerente.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${gerentesAtivos.includes(gerente.id) ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" : "bg-background hover:bg-muted"}`} 
                      onClick={() => toggleGerente(gerente.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={gerentesAtivos.includes(gerente.id)} className="pointer-events-none" />
                        <div>
                          <p className="font-medium">{gerente.nome}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {gerente.telefone}
                            </span>
                            {gerente.loja && (
                              <span className="flex items-center gap-1">
                                <Store className="h-3 w-3" />
                                {gerente.loja.nome}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {gerentesSemTelefone.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Gerentes sem telefone cadastrado:
                  </p>
                  <div className="space-y-2">
                    {gerentesSemTelefone.map(gerente => (
                      <div key={gerente.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 opacity-60">
                        <div className="flex items-center gap-3">
                          <Checkbox disabled checked={false} />
                          <div>
                            <p className="font-medium">{gerente.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              Telefone não cadastrado
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="flex-1">
          {salvarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Configuração
        </Button>
        <Button variant="outline" onClick={enviarTeste} disabled={isEnviandoTeste || gerentesAtivos.length === 0} className="flex-1 gap-2">
          {isEnviandoTeste ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Teste de Cobrança
        </Button>
      </div>

      {gerentesAtivos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Selecione pelo menos um gerente para habilitar o envio de teste.
        </p>
      )}

      {/* Histórico de Cobranças - Usando componente compartilhado */}
      <WhatsAppHistoricoTable<CobrancaLog>
        logs={logs}
        isLoading={isLoadingLogs}
        filtroHistorico={filtroHistorico}
        onFiltroChange={setFiltroHistorico}
        titulo="Histórico de Cobranças"
        descricao="Registros de cobranças enviadas aos gerentes"
        headerIcon={<History className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        headerBgClass="bg-amber-100 dark:bg-amber-900"
        renderDestinatario={(log) => {
          const gerenteNome = gerentesMap[log.gerente_id] || "Gerente";
          const lojaNome = lojasMap[log.loja_id] || "";
          return (
            <div>
              <p className="font-medium">{gerenteNome}</p>
              {lojaNome && <p className="text-xs text-muted-foreground">{lojaNome}</p>}
            </div>
          );
        }}
        colunasExtrasHeader={
          <>
            <TableHead>Horário</TableHead>
            <TableHead>Nível</TableHead>
          </>
        }
        renderColunasExtras={(log) => (
          <>
            <td className="p-4 align-middle">
              <div>
                <p>{log.horario_lancamento}</p>
                <p className="text-xs text-muted-foreground">+{log.minutos_atraso}min</p>
              </div>
            </td>
            <td className="p-4 align-middle">
              {log.nivel_cobranca === 0 ? (
                <Badge variant="secondary">Teste</Badge>
              ) : (
                <Badge variant="outline">Nível {log.nivel_cobranca}</Badge>
              )}
            </td>
          </>
        )}
        getDestinatarioNome={(log) => gerentesMap[log.gerente_id] || "Gerente"}
      />
    </div>
  );
}
