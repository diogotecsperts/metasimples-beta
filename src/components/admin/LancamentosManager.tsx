import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfMonth, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CalendarIcon, AlertTriangle, Clock, Check, Store } from "lucide-react";
import { AdminLancamentoDialog } from "./AdminLancamentoDialog";
import { registrarAuditLog } from "@/lib/auditLog";
import type { Database } from "@/integrations/supabase/types";

type HorarioLancamento = Database["public"]["Enums"]["horario_lancamento"];

const HORARIOS_BASE: HorarioLancamento[] = ["10:00", "14:00", "16:00", "19:00"];
const HORARIO_TARDIO: HorarioLancamento = "23:00";

export function LancamentosManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedHorario, setSelectedHorario] = useState<HorarioLancamento | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hoje = startOfDay(new Date());
  const dataSelecionada = startOfDay(selectedDate);
  const isDiaAnterior = isBefore(dataSelecionada, hoje);
  const mesAtual = new Date();
  const inicioMes = startOfMonth(mesAtual);

  // Buscar profile do admin logado
  const { data: adminProfile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar lojas
  const { data: lojas = [], isLoading: isLoadingLojas } = useQuery({
    queryKey: ["lojas-admin-lancamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const selectedLoja = useMemo(
    () => lojas.find((l) => l.id === selectedLojaId),
    [lojas, selectedLojaId]
  );

  const horarios: HorarioLancamento[] = useMemo(() => {
    if (!selectedLoja) return HORARIOS_BASE;
    return selectedLoja.possui_fechamento_tardio
      ? [...HORARIOS_BASE, HORARIO_TARDIO]
      : HORARIOS_BASE;
  }, [selectedLoja]);

  // Buscar meta da loja para o mês
  const { data: metaMensal } = useQuery({
    queryKey: ["meta-mensal-admin", selectedLojaId, selectedDate.getMonth(), selectedDate.getFullYear()],
    queryFn: async () => {
      if (!selectedLojaId) return null;
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("*")
        .eq("loja_id", selectedLojaId)
        .eq("mes", selectedDate.getMonth() + 1)
        .eq("ano", selectedDate.getFullYear())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLojaId,
  });

  // Buscar lançamentos do dia
  const dataFormatada = format(selectedDate, "yyyy-MM-dd");
  const { data: lancamentos = [], isLoading: isLoadingLancamentos } = useQuery({
    queryKey: ["lancamentos-admin", selectedLojaId, dataFormatada],
    queryFn: async () => {
      if (!selectedLojaId) return [];
      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("*")
        .eq("loja_id", selectedLojaId)
        .eq("data", dataFormatada);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLojaId,
  });

  const lancamentosPorHorario = useMemo(() => {
    const map: Record<string, (typeof lancamentos)[0] | undefined> = {};
    lancamentos.forEach((l) => {
      if (l.horario) map[l.horario] = l;
    });
    return map;
  }, [lancamentos]);

  const totalVendido = useMemo(() => {
    if (lancamentos.length === 0) return 0;
    return Math.max(...lancamentos.map((l) => l.valor_acumulado));
  }, [lancamentos]);

  const metaDiaria = metaMensal?.meta_diaria_calculada ?? 0;
  const percentual = metaDiaria > 0 ? (totalVendido / metaDiaria) * 100 : 0;

  // Mutation para criar/editar lançamento
  const lancamentoMutation = useMutation({
    mutationFn: async ({
      horario,
      valor,
      lancamentoExistente,
    }: {
      horario: HorarioLancamento;
      valor: number;
      lancamentoExistente?: (typeof lancamentos)[0];
    }) => {
      if (!selectedLojaId || !selectedLoja) throw new Error("Loja não selecionada");

      if (lancamentoExistente) {
        // Editar
        const { data, error } = await supabase
          .from("lancamentos_diarios")
          .update({ valor_acumulado: valor })
          .eq("id", lancamentoExistente.id)
          .select()
          .single();
        if (error) throw error;
        return { data, action: "update" as const, valorAnterior: lancamentoExistente.valor_acumulado };
      } else {
        // Criar
        const { data, error } = await supabase
          .from("lancamentos_diarios")
          .insert({
            loja_id: selectedLojaId,
            data: dataFormatada,
            horario,
            valor_acumulado: valor,
          })
          .select()
          .single();
        if (error) throw error;
        return { data, action: "create" as const };
      }
    },
    onSuccess: async (result, variables) => {
      // Registrar audit log
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: adminProfile?.nome || "Admin",
        userRole: "admin",
        action: result.action,
        entity: "lancamento",
        entityId: result.data.id,
        entityName: `${selectedLoja?.nome} - ${variables.horario} (${dataFormatada})`,
        details: {
          ...(result.action === "update"
            ? { valor_anterior: result.valorAnterior, valor_novo: variables.valor }
            : { valor: variables.valor }),
          horario: variables.horario,
          data: dataFormatada,
          alteracao_administrativa: true,
          dia_anterior: isDiaAnterior,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["lancamentos-admin", selectedLojaId, dataFormatada] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success(
        result.action === "create"
          ? "Lançamento registrado com sucesso"
          : "Lançamento atualizado com sucesso",
        { duration: 5000 }
      );
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar lançamento:", error);
      toast.error("Erro ao salvar lançamento", { duration: 6000 });
    },
  });

  const handleSlotClick = (horario: HorarioLancamento) => {
    // Verificar sequência: não pode pular horários anteriores
    const idx = horarios.indexOf(horario);
    for (let i = 0; i < idx; i++) {
      if (!lancamentosPorHorario[horarios[i]]) {
        toast.error(`Preencha primeiro o horário ${horarios[i]}`, { duration: 5000 });
        return;
      }
    }
    setSelectedHorario(horario);
    setDialogOpen(true);
  };

  const handleSubmitLancamento = async (valor: number) => {
    if (!selectedHorario) return;
    setIsSubmitting(true);
    try {
      await lancamentoMutation.mutateAsync({
        horario: selectedHorario,
        valor,
        lancamentoExistente: lancamentosPorHorario[selectedHorario],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSlotState = (horario: HorarioLancamento) => {
    const lancamento = lancamentosPorHorario[horario];
    const idx = horarios.indexOf(horario);
    const anteriorNaoPreenchido = horarios.slice(0, idx).some((h) => !lancamentosPorHorario[h]);

    if (lancamento) {
      return { status: "preenchido" as const, valor: lancamento.valor_acumulado };
    }
    if (anteriorNaoPreenchido) {
      return { status: "bloqueado" as const };
    }
    return { status: "pendente" as const };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Gerenciamento de Lançamentos</h2>
        <p className="text-sm text-muted-foreground">
          Crie ou edite lançamentos diários de qualquer loja
        </p>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Loja</label>
          <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma loja">
                {selectedLoja && (
                  <span className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    {selectedLoja.nome}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {lojas.map((loja) => (
                <SelectItem key={loja.id} value={loja.id}>
                  {loja.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Data</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) =>
                  isBefore(date, inicioMes) || isAfter(date, hoje)
                }
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Aviso de dia anterior */}
      {isDiaAnterior && selectedLojaId && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            Você está editando o dia{" "}
            <strong>{format(selectedDate, "dd/MM/yyyy")}</strong>. Alterações em dias
            anteriores podem causar divergências com relatórios já enviados.
          </p>
        </div>
      )}

      {/* Conteúdo principal */}
      {!selectedLojaId ? (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Selecione uma loja para visualizar os lançamentos</p>
        </div>
      ) : isLoadingLancamentos ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p>Carregando lançamentos...</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Meta Diária:</span>{" "}
                <span className="font-semibold">
                  {metaDiaria > 0
                    ? `R$ ${metaDiaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Vendido:</span>{" "}
                <span className="font-semibold">
                  R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Atingimento:</span>{" "}
                <span
                  className={cn(
                    "font-semibold",
                    percentual >= 100
                      ? "text-green-600"
                      : percentual >= 80
                      ? "text-amber-600"
                      : "text-red-600"
                  )}
                >
                  {metaDiaria > 0 ? `${percentual.toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>
            {metaDiaria > 0 && (
              <Progress value={Math.min(percentual, 100)} className="h-2" />
            )}
          </div>

          {/* Timeline de horários */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Horários</h3>
            <div
              className={cn(
                "grid gap-3",
                horarios.length === 5
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                  : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
              )}
            >
              {horarios.map((horario) => {
                const state = getSlotState(horario);
                return (
                  <button
                    key={horario}
                    onClick={() => state.status !== "bloqueado" && handleSlotClick(horario)}
                    disabled={state.status === "bloqueado"}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all",
                      state.status === "preenchido" &&
                        "bg-green-500/10 border-green-500/30 hover:bg-green-500/20",
                      state.status === "pendente" &&
                        "bg-muted/50 border-border hover:bg-muted",
                      state.status === "bloqueado" &&
                        "bg-muted/30 border-border/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-1 text-sm font-medium mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      {horario}
                    </div>
                    {state.status === "preenchido" && (
                      <>
                        <Check className="absolute top-2 right-2 h-4 w-4 text-green-600" />
                        <span className="text-lg font-semibold text-green-700 dark:text-green-400">
                          R$ {state.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                    {state.status === "pendente" && (
                      <span className="text-xs text-muted-foreground">Clique para preencher</span>
                    )}
                    {state.status === "bloqueado" && (
                      <span className="text-xs text-muted-foreground">Preencha os anteriores</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Dialog de lançamento */}
      {selectedHorario && selectedLoja && (
        <AdminLancamentoDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          horario={selectedHorario}
          valorAtual={lancamentosPorHorario[selectedHorario]?.valor_acumulado}
          onSubmit={handleSubmitLancamento}
          isSubmitting={isSubmitting}
          lojaNome={selectedLoja.nome}
          data={selectedDate}
          isEdicao={!!lancamentosPorHorario[selectedHorario]}
        />
      )}
    </div>
  );
}
