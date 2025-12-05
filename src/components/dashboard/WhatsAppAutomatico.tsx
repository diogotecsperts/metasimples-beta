import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Phone, Store, Wrench } from "lucide-react";

interface Gerente {
  id: string;
  nome: string;
  telefone: string | null;
  loja_id: string | null;
  loja?: { nome: string } | null;
}

interface WhatsAppSettings {
  id: string;
  ativo: boolean;
  horarios_ativos: string[];
  gerentes_ativos: string[];
}

const HORARIOS_DISPONIVEIS = [
  { value: "10:10", label: "10:10" },
  { value: "14:10", label: "14:10" },
  { value: "16:10", label: "16:10" },
  { value: "19:10", label: "19:10" },
  { value: "23:10", label: "23:10" },
];

export function WhatsAppAutomatico() {
  const queryClient = useQueryClient();
  const [ativo, setAtivo] = useState(false);
  const [horariosAtivos, setHorariosAtivos] = useState<string[]>([]);
  const [gerentesAtivos, setGerentesAtivos] = useState<string[]>([]);
  const [isEnviandoTeste, setIsEnviandoTeste] = useState(false);

  // Buscar configurações existentes
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_report_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WhatsAppSettings | null;
    },
  });

  // Buscar todos os gerentes com suas lojas
  const { data: gerentes = [], isLoading: isLoadingGerentes } = useQuery({
    queryKey: ["gerentes-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          nome,
          telefone,
          loja_id,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "gerente");

      if (error) throw error;

      // Buscar nomes das lojas
      const lojasIds = data?.filter(g => g.loja_id).map(g => g.loja_id) || [];
      let lojasMap: Record<string, string> = {};
      
      if (lojasIds.length > 0) {
        const { data: lojas } = await supabase
          .from("lojas")
          .select("id, nome")
          .in("id", lojasIds);
        
        if (lojas) {
          lojasMap = Object.fromEntries(lojas.map(l => [l.id, l.nome]));
        }
      }

      return (data || []).map(g => ({
        ...g,
        loja: g.loja_id ? { nome: lojasMap[g.loja_id] || "Loja não encontrada" } : null
      })) as Gerente[];
    },
  });

  // Atualizar estado local quando settings carregar
  useEffect(() => {
    if (settings) {
      setAtivo(settings.ativo);
      setHorariosAtivos(settings.horarios_ativos || []);
      setGerentesAtivos(settings.gerentes_ativos || []);
    }
  }, [settings]);

  // Mutation para salvar configurações
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ativo,
        horarios_ativos: horariosAtivos,
        gerentes_ativos: gerentesAtivos,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from("whatsapp_report_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_report_settings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  // Função para enviar teste
  const enviarTeste = async () => {
    if (gerentesAtivos.length === 0) {
      toast.error("Selecione pelo menos um gerente para enviar o teste");
      return;
    }

    setIsEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-report", {
        body: { isTest: true },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "Teste enviado com sucesso!");
        if (data.failCount > 0) {
          toast.warning(`${data.failCount} envio(s) falharam. Verifique os logs.`);
        }
      } else {
        toast.error(data.message || data.error || "Erro ao enviar teste");
      }
    } catch (error: any) {
      console.error("Erro ao enviar teste:", error);
      toast.error(`Erro ao enviar teste: ${error.message}`);
    } finally {
      setIsEnviandoTeste(false);
    }
  };

  const toggleHorario = (horario: string) => {
    setHorariosAtivos((prev) =>
      prev.includes(horario)
        ? prev.filter((h) => h !== horario)
        : [...prev, horario]
    );
  };

  const toggleGerente = (gerenteId: string) => {
    setGerentesAtivos((prev) =>
      prev.includes(gerenteId)
        ? prev.filter((g) => g !== gerenteId)
        : [...prev, gerenteId]
    );
  };

  const gerentesComTelefone = gerentes.filter(g => g.telefone && g.telefone.trim() !== '');
  const gerentesSemTelefone = gerentes.filter(g => !g.telefone || g.telefone.trim() === '');

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
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Relatórios WhatsApp
                  <Badge variant="outline" className="gap-1">
                    <Wrench className="h-3 w-3" />
                    Beta
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Envie ranking automático para gerentes via WhatsApp
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {ativo ? "Ativo" : "Inativo"}
              </span>
              <Switch
                checked={ativo}
                onCheckedChange={setAtivo}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Horários de Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Horários de Envio</CardTitle>
          <CardDescription>
            Selecione os horários em que os relatórios serão enviados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {HORARIOS_DISPONIVEIS.map((horario) => (
              <div
                key={horario.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  horariosAtivos.includes(horario.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => toggleHorario(horario.value)}
              >
                <Checkbox
                  checked={horariosAtivos.includes(horario.value)}
                  className="pointer-events-none"
                />
                <span className="font-medium">{horario.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gerentes Destinatários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gerentes Destinatários</CardTitle>
          <CardDescription>
            Selecione quais gerentes receberão os relatórios via WhatsApp
          </CardDescription>
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
                  {gerentesComTelefone.map((gerente) => (
                    <div
                      key={gerente.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        gerentesAtivos.includes(gerente.id)
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          : "bg-background hover:bg-muted"
                      }`}
                      onClick={() => toggleGerente(gerente.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={gerentesAtivos.includes(gerente.id)}
                          className="pointer-events-none"
                        />
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
                    {gerentesSemTelefone.map((gerente) => (
                      <div
                        key={gerente.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50 opacity-60"
                      >
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
        <Button
          onClick={() => salvarMutation.mutate()}
          disabled={salvarMutation.isPending}
          className="flex-1"
        >
          {salvarMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Salvar Configuração
        </Button>
        <Button
          variant="outline"
          onClick={enviarTeste}
          disabled={isEnviandoTeste || gerentesAtivos.length === 0}
          className="flex-1 gap-2"
        >
          {isEnviandoTeste ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar Teste Agora
        </Button>
      </div>

      {gerentesAtivos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Selecione pelo menos um gerente para habilitar o envio de teste.
        </p>
      )}
    </div>
  );
}
