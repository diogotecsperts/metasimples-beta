import { useState, useEffect } from "react";
import { Mail, Plus, X, Send, Loader2, Check, AlertCircle, Clock, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const HORARIOS_AUTOMATICOS = [
  { id: "10:00", label: "10:00" },
  { id: "14:00", label: "14:00" },
  { id: "16:00", label: "16:00" },
  { id: "19:00", label: "19:00" },
  { id: "23:00", label: "23:00" },
];

interface ReportSettings {
  id?: string;
  emails: string[];
  horarios_ativos: string[];
  horarios_manuais: string[];
  modo: 'automatico' | 'manual';
  ativo: boolean;
}

// Validação de formato HH:MM
function isValidTimeFormat(time: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Formata para HH:MM com zero à esquerda
function formatTime(time: string): string {
  const parts = time.split(':');
  if (parts.length !== 2) return time;
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function RelatoriosAutomaticos() {
  const [settings, setSettings] = useState<ReportSettings>({
    emails: [],
    horarios_ativos: [],
    horarios_manuais: ['', '', '', '', ''],
    modo: 'automatico',
    ativo: false,
  });
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [proximoHorario, setProximoHorario] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("report_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Preenche horários manuais com valores do banco ou strings vazias
        const horariosManuais = data.horarios_manuais || [];
        const paddedHorarios = [...horariosManuais];
        while (paddedHorarios.length < 5) {
          paddedHorarios.push('');
        }

        setSettings({
          id: data.id,
          emails: data.emails || [],
          horarios_ativos: data.horarios_ativos || [],
          horarios_manuais: paddedHorarios.slice(0, 5),
          modo: (data.modo as 'automatico' | 'manual') || 'automatico',
          ativo: data.ativo || false,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModoChange = (modo: 'automatico' | 'manual') => {
    setSettings(prev => ({ ...prev, modo }));
    setHasChanges(true);
  };

  const handleHorarioToggle = (horarioId: string) => {
    setSettings(prev => {
      const newHorarios = prev.horarios_ativos.includes(horarioId)
        ? prev.horarios_ativos.filter(h => h !== horarioId)
        : [...prev.horarios_ativos, horarioId];
      return { ...prev, horarios_ativos: newHorarios };
    });
    setHasChanges(true);
  };

  const handleHorarioManualChange = (index: number, value: string) => {
    // Remove tudo que não é número
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    // Limita a 4 dígitos
    const limited = digitsOnly.slice(0, 4);
    
    // Auto-insere os dois pontos após os 2 primeiros dígitos
    let formatted = limited;
    if (limited.length > 2) {
      formatted = `${limited.slice(0, 2)}:${limited.slice(2)}`;
    }
    
    setSettings(prev => {
      const newHorarios = [...prev.horarios_manuais];
      newHorarios[index] = formatted;
      return { ...prev, horarios_manuais: newHorarios };
    });
    setHasChanges(true);
  };

  const handleHorarioManualBlur = (index: number) => {
    const value = settings.horarios_manuais[index];
    if (value && isValidTimeFormat(value)) {
      setSettings(prev => {
        const newHorarios = [...prev.horarios_manuais];
        newHorarios[index] = formatTime(value);
        return { ...prev, horarios_manuais: newHorarios };
      });
    }
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    if (settings.emails.includes(email)) {
      toast({
        title: "Email já existe",
        description: "Este email já está na lista.",
        variant: "destructive",
      });
      return;
    }

    setSettings(prev => ({
      ...prev,
      emails: [...prev.emails, email],
    }));
    setNewEmail("");
    setHasChanges(true);
  };

  const handleRemoveEmail = (email: string) => {
    setSettings(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e !== email),
    }));
    setHasChanges(true);
  };

  const handleAtivoToggle = (checked: boolean) => {
    setSettings(prev => ({ ...prev, ativo: checked }));
    setHasChanges(true);
  };

  const validateManualHorarios = (): boolean => {
    if (settings.modo !== 'manual') return true;
    
    const horariosValidos = settings.horarios_manuais.filter(h => h.trim() !== '');
    
    if (horariosValidos.length === 0) {
      toast({
        title: "Adicione pelo menos um horário",
        description: "No modo manual, é necessário ter pelo menos um horário configurado.",
        variant: "destructive",
      });
      return false;
    }

    // Verifica duplicatas
    const horariosFormatados = horariosValidos.map(h => formatTime(h));
    const horariosUnicos = new Set(horariosFormatados);
    if (horariosUnicos.size !== horariosFormatados.length) {
      toast({
        title: "Horário duplicado",
        description: "Não é permitido configurar o mesmo horário em mais de um campo.",
        variant: "destructive",
      });
      return false;
    }

    for (const horario of horariosValidos) {
      if (!isValidTimeFormat(horario)) {
        toast({
          title: "Horário inválido",
          description: `O horário "${horario}" não está no formato correto (HH:MM).`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (settings.emails.length === 0) {
      toast({
        title: "Adicione pelo menos um email",
        description: "É necessário ter pelo menos um email para receber os relatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!validateManualHorarios()) return;

    setIsSaving(true);
    try {
      // Filtra horários manuais vazios e formata
      const horariosManuaisLimpos = settings.horarios_manuais
        .filter(h => h.trim() !== '')
        .map(h => formatTime(h));

      const dataToSave = {
        emails: settings.emails,
        horarios_ativos: settings.horarios_ativos,
        horarios_manuais: horariosManuaisLimpos,
        modo: settings.modo,
        ativo: settings.ativo,
      };

      if (settings.id) {
        const { error } = await supabase
          .from("report_settings")
          .update(dataToSave)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("report_settings")
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de relatórios foram atualizadas com sucesso.",
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (settings.emails.length === 0) {
      toast({
        title: "Adicione pelo menos um email",
        description: "É necessário ter pelo menos um email para enviar o teste.",
        variant: "destructive",
      });
      return;
    }

    if (hasChanges || !settings.id) {
      await handleSave();
    }

    setIsSendingTest(true);
    try {
      const response = await supabase.functions.invoke("send-report", {
        body: { horario: "Teste", isTest: true },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        toast({
          title: "Relatório de teste enviado!",
          description: `Verifique a caixa de entrada de: ${settings.emails.join(", ")}`,
        });
      } else {
        throw new Error(response.data?.message || "Erro desconhecido");
      }
    } catch (error: any) {
      console.error("Erro ao enviar teste:", error);
      toast({
        title: "Erro ao enviar teste",
        description: error.message || "Não foi possível enviar o relatório de teste.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const horariosAtivos = settings.modo === 'automatico' 
    ? settings.horarios_ativos 
    : settings.horarios_manuais.filter(h => h.trim() !== '');

  // Calcula o próximo horário de envio
  const calcularProximoHorario = (horarios: string[]): string | null => {
    if (horarios.length === 0) return null;
    
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    const horariosOrdenados = horarios
      .filter(h => h && h.includes(':'))
      .map(h => {
        const [horas, minutos] = h.split(':').map(Number);
        return { time: h, totalMinutes: horas * 60 + minutos };
      })
      .sort((a, b) => a.totalMinutes - b.totalMinutes);
    
    if (horariosOrdenados.length === 0) return null;
    
    // Próximo horário hoje
    for (const h of horariosOrdenados) {
      if (h.totalMinutes > nowMinutes) {
        return h.time;
      }
    }
    
    // Se todos passaram, primeiro de amanhã
    return `${horariosOrdenados[0].time} (amanhã)`;
  };

  // Atualiza o próximo horário a cada minuto
  useEffect(() => {
    if (!settings.ativo || horariosAtivos.length === 0) {
      setProximoHorario(null);
      return;
    }
    
    const atualizar = () => {
      setProximoHorario(calcularProximoHorario(horariosAtivos));
    };
    
    atualizar();
    const interval = setInterval(atualizar, 60000);
    
    return () => clearInterval(interval);
  }, [settings.ativo, horariosAtivos.join(',')]);

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-xl md:text-2xl font-semibold">Relatórios Automáticos</h2>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="ativo-switch" className="text-sm text-muted-foreground">
            {settings.ativo ? "Ativo" : "Inativo"}
          </Label>
          <Switch
            id="ativo-switch"
            checked={settings.ativo}
            onCheckedChange={handleAtivoToggle}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Receba relatórios consolidados automaticamente nos horários configurados
      </p>

      {/* Seletor de Modo */}
      <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
        <p className="text-sm font-medium mb-3 flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Modo de Agendamento:
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={settings.modo === 'automatico' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModoChange('automatico')}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Horários Automáticos
          </Button>
          <Button
            variant={settings.modo === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModoChange('manual')}
            className="flex items-center gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Horários Manuais
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {settings.modo === 'automatico' 
            ? "Selecione entre os horários predefinidos (10:00, 14:00, 16:00, 19:00, 23:00)"
            : "Configure até 5 horários personalizados no formato HH:MM"
          }
        </p>
      </div>

      {/* Horários Automáticos */}
      {settings.modo === 'automatico' && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-3">Horários de Envio:</p>
          <div className="flex flex-wrap gap-4">
            {HORARIOS_AUTOMATICOS.map(horario => (
              <div key={horario.id} className="flex items-center gap-2">
                <Checkbox
                  id={horario.id}
                  checked={settings.horarios_ativos.includes(horario.id)}
                  onCheckedChange={() => handleHorarioToggle(horario.id)}
                />
                <label
                  htmlFor={horario.id}
                  className="text-sm cursor-pointer select-none"
                >
                  {horario.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Horários Manuais */}
      {settings.modo === 'manual' && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-3">Horários Personalizados (HH:MM):</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {settings.horarios_manuais.map((horario, index) => (
              <div key={index} className="relative">
                <Input
                  type="text"
                  placeholder="HH:MM"
                  value={horario}
                  onChange={(e) => handleHorarioManualChange(index, e.target.value)}
                  onBlur={() => handleHorarioManualBlur(index)}
                  maxLength={5}
                  className={`text-center ${
                    horario && !isValidTimeFormat(horario) 
                      ? 'border-destructive focus-visible:ring-destructive' 
                      : ''
                  }`}
                />
                {horario && isValidTimeFormat(horario) && (
                  <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Deixe em branco os campos que não deseja usar. O relatório será enviado exatamente no minuto configurado.
          </p>
        </div>
      )}

      {/* Email Input */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block">
          Emails de Destino:
        </label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Digite um email e pressione Adicionar"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddEmail();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddEmail}
            disabled={!newEmail.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Email List */}
      {settings.emails.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {settings.emails.map(email => (
              <Badge
                key={email}
                variant="secondary"
                className="pl-3 pr-1 py-1.5 flex items-center gap-1"
              >
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="ml-1 p-0.5 hover:bg-muted rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {settings.emails.length === 0 && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Nenhum email adicionado ainda</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleSendTest}
          disabled={isSendingTest || settings.emails.length === 0}
        >
          {isSendingTest ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar Teste Agora
            </>
          )}
        </Button>
      </div>

      {/* Status info */}
      {settings.ativo && horariosAtivos.length > 0 && settings.emails.length > 0 && (
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm text-primary font-medium">
            ✓ Relatórios ativos ({settings.modo === 'automatico' ? 'Automático' : 'Manual'}): {horariosAtivos.sort().join(", ")}
          </p>
          
          <p className="text-xs text-muted-foreground mt-2">
            {settings.modo === 'automatico' 
              ? "Os emails serão enviados automaticamente nos horários selecionados"
              : "Os emails serão enviados automaticamente nos horários personalizados configurados"
            }
          </p>
          
          {/* Indicador do próximo horário */}
          {proximoHorario && (
            <div className="flex items-center gap-2 mt-3 py-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-md w-fit">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Próximo envio: {proximoHorario}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
