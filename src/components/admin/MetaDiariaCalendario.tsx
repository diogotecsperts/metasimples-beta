import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, getDaysInMonth, getDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Settings, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { registrarAuditLog } from "@/lib/auditLog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  calcularMetasDiariasComAjustes,
  calcularPreviaRedistribuicao,
  listarDomingosDoMes,
  isDomingo,
  type AjusteDiario,
} from "@/lib/calcularMetaDiariaComAjustes";
import { AjusteMetaDiariaDialog } from "./AjusteMetaDiariaDialog";

type Meta = {
  id: string;
  loja_id: string;
  mes: number;
  ano: number;
  meta_mensal: number;
  meta_diaria_calculada: number;
};

type Loja = {
  id: string;
  nome: string;
  tipo_operacional: "A" | "B";
};

type MetaDiariaCalendarioProps = {
  meta: Meta;
  loja: Loja;
  isOpen: boolean;
  onClose: () => void;
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MetaDiariaCalendario({
  meta,
  loja,
  isOpen,
  onClose,
}: MetaDiariaCalendarioProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar ajustes existentes
  const { data: ajustes = [], isLoading } = useQuery({
    queryKey: ["metas-diarias-ajustes", meta.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_diarias_ajustes")
        .select("*")
        .eq("meta_mensal_id", meta.id);

      if (error) throw error;
      return data as AjusteDiario[];
    },
    enabled: isOpen,
  });

  // Calcular metas diárias com ajustes
  const metasCalculadas = useMemo(() => {
    return calcularMetasDiariasComAjustes(
      meta.meta_mensal,
      loja.tipo_operacional,
      meta.mes,
      meta.ano,
      ajustes
    );
  }, [meta.meta_mensal, loja.tipo_operacional, meta.mes, meta.ano, ajustes]);

  // Gerar grid do calendário
  const diasCalendario = useMemo(() => {
    const primeiroDia = startOfMonth(new Date(meta.ano, meta.mes - 1));
    const diaSemanaInicio = getDay(primeiroDia);
    const totalDias = getDaysInMonth(primeiroDia);
    
    const dias: (number | null)[] = [];
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }
    
    // Dias do mês
    for (let dia = 1; dia <= totalDias; dia++) {
      dias.push(dia);
    }
    
    return dias;
  }, [meta.mes, meta.ano]);

  // Mutation para criar/atualizar ajuste
  const ajusteMutation = useMutation({
    mutationFn: async ({
      data,
      metaAjustada,
      motivo,
      aplicarTodosDomingos,
    }: {
      data: string;
      metaAjustada: number;
      motivo: string;
      aplicarTodosDomingos: boolean;
    }) => {
      const metaOriginal = meta.meta_diaria_calculada;
      const datasParaAjustar = aplicarTodosDomingos && isDomingo(data)
        ? listarDomingosDoMes(meta.mes, meta.ano)
        : [data];

      const resultados: { data: string; id: string }[] = [];

      for (const dataAjuste of datasParaAjustar) {
        // Verificar se já existe ajuste para essa data
        const ajusteExistente = ajustes.find(a => a.data === dataAjuste);

        if (ajusteExistente) {
          // Atualizar existente
          const { error } = await supabase
            .from("metas_diarias_ajustes")
            .update({
              meta_ajustada: metaAjustada,
              motivo,
            })
            .eq("id", ajusteExistente.id);

          if (error) throw error;
          resultados.push({ data: dataAjuste, id: ajusteExistente.id });
        } else {
          // Criar novo
          const { data: newAjuste, error } = await supabase
            .from("metas_diarias_ajustes")
            .insert({
              meta_mensal_id: meta.id,
              loja_id: loja.id,
              data: dataAjuste,
              meta_original: metaOriginal,
              meta_ajustada: metaAjustada,
              motivo,
              created_by: user?.id,
            })
            .select()
            .single();

          if (error) throw error;
          resultados.push({ data: dataAjuste, id: newAjuste.id });
        }
      }

      return { resultados, aplicarTodosDomingos, motivo };
    },
    onSuccess: async ({ resultados, aplicarTodosDomingos, motivo }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user?.id)
        .single();

      for (const res of resultados) {
        await registrarAuditLog({
          userId: user?.id || "",
          userNome: profile?.nome || "Admin",
          userRole: "admin",
          action: "update",
          entity: "meta_ajuste",
          entityId: res.id,
          entityName: `${loja.nome} - ${format(new Date(res.data + "T12:00:00"), "dd/MM/yyyy")}`,
          details: {
            motivo,
            aplicado_todos_domingos: aplicarTodosDomingos,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["metas-diarias-ajustes"] });
      setSelectedDay(null);
      
      toast({
        title: "Ajuste salvo",
        description: aplicarTodosDomingos
          ? `Meta ajustada para ${resultados.length} domingos do mês.`
          : "Meta diária ajustada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar ajuste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para remover ajuste
  const removerAjusteMutation = useMutation({
    mutationFn: async (data: string) => {
      const ajuste = ajustes.find(a => a.data === data);
      if (!ajuste) throw new Error("Ajuste não encontrado");

      const { error } = await supabase
        .from("metas_diarias_ajustes")
        .delete()
        .eq("id", ajuste.id);

      if (error) throw error;
      return { ajusteId: ajuste.id, data };
    },
    onSuccess: async ({ ajusteId, data }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user?.id)
        .single();

      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "delete",
        entity: "meta_ajuste",
        entityId: ajusteId,
        entityName: `${loja.nome} - ${format(new Date(data + "T12:00:00"), "dd/MM/yyyy")}`,
      });

      queryClient.invalidateQueries({ queryKey: ["metas-diarias-ajustes"] });
      setSelectedDay(null);
      
      toast({
        title: "Ajuste removido",
        description: "A meta voltou ao valor calculado automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover ajuste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMetaForDay = (dia: number) => {
    const data = format(new Date(meta.ano, meta.mes - 1, dia), "yyyy-MM-dd");
    return metasCalculadas.find(m => m.data === data);
  };

  const handleDayClick = (dia: number) => {
    const data = format(new Date(meta.ano, meta.mes - 1, dia), "yyyy-MM-dd");
    setSelectedDay(data);
  };

  const handleSaveAjuste = (metaAjustada: number, motivo: string, aplicarTodosDomingos: boolean) => {
    if (!selectedDay) return;
    ajusteMutation.mutate({
      data: selectedDay,
      metaAjustada,
      motivo,
      aplicarTodosDomingos,
    });
  };

  const handleRemoveAjuste = () => {
    if (!selectedDay) return;
    removerAjusteMutation.mutate(selectedDay);
  };

  const selectedDayMeta = selectedDay
    ? metasCalculadas.find(m => m.data === selectedDay)
    : null;

  const selectedDayAjuste = selectedDay
    ? ajustes.find(a => a.data === selectedDay)
    : null;

  const selectedDayPrevia = selectedDay
    ? calcularPreviaRedistribuicao(
        meta.meta_mensal,
        loja.tipo_operacional,
        meta.mes,
        meta.ano,
        ajustes,
        {
          data: selectedDay,
          metaAjustada: selectedDayAjuste?.meta_ajustada ?? meta.meta_diaria_calculada / 2,
          metaOriginal: meta.meta_diaria_calculada,
        }
      )
    : null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Ajuste de Metas Diárias
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {loja.nome} - {format(new Date(meta.ano, meta.mes - 1), "MMMM yyyy", { locale: ptBR })}
            </p>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Meta Mensal</p>
                <p className="font-semibold">{formatCurrency(meta.meta_mensal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Diária Base</p>
                <p className="font-semibold">{formatCurrency(meta.meta_diaria_calculada)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo Operacional</p>
                <p className="font-semibold">
                  {loja.tipo_operacional === "A" ? "Dom a Dom" : "Seg a Sáb"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ajustes Ativos</p>
                <p className="font-semibold">{ajustes.length}</p>
              </div>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary/20 border border-primary"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500"></div>
                <span>Ajustado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted border border-muted-foreground/30"></div>
                <span>Sem meta (domingo)</span>
              </div>
            </div>

            {/* Calendário */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Cabeçalho dias da semana */}
                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA.map((dia) => (
                    <div
                      key={dia}
                      className="text-center text-xs font-medium text-muted-foreground py-1"
                    >
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Grid de dias */}
                <div className="grid grid-cols-7 gap-1">
                  {diasCalendario.map((dia, index) => {
                    if (dia === null) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const metaDia = getMetaForDay(dia);
                    const isDomingoB = loja.tipo_operacional === "B" && 
                      getDay(new Date(meta.ano, meta.mes - 1, dia)) === 0;

                    return (
                      <button
                        key={dia}
                        onClick={() => !isDomingoB && handleDayClick(dia)}
                        disabled={isDomingoB}
                        className={cn(
                          "aspect-square rounded-md p-1 text-xs flex flex-col items-center justify-center transition-colors",
                          "hover:ring-2 hover:ring-primary/50",
                          isDomingoB && "bg-muted text-muted-foreground cursor-not-allowed",
                          !isDomingoB && !metaDia?.ajusteManual && "bg-primary/10 border border-primary/30",
                          metaDia?.ajusteManual && "bg-amber-500/20 border border-amber-500"
                        )}
                      >
                        <span className="font-medium">{dia}</span>
                        {!isDomingoB && metaDia && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-full">
                            {(metaDia.metaCalculada / 1000).toFixed(0)}k
                          </span>
                        )}
                        {metaDia?.ajusteManual && (
                          <Settings className="h-2.5 w-2.5 text-amber-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aviso sobre redistribuição */}
            {ajustes.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {ajustes.length} dia(s) com ajuste manual. A diferença foi redistribuída 
                  proporcionalmente entre os dias sem ajuste.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog de ajuste individual */}
      {selectedDay && (
        <AjusteMetaDiariaDialog
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          data={selectedDay}
          metaOriginal={meta.meta_diaria_calculada}
          metaAtual={selectedDayMeta?.metaCalculada ?? meta.meta_diaria_calculada}
          ajusteExistente={selectedDayAjuste}
          previa={selectedDayPrevia}
          lojaNome={loja.nome}
          onSave={handleSaveAjuste}
          onRemove={handleRemoveAjuste}
          isSaving={ajusteMutation.isPending || removerAjusteMutation.isPending}
        />
      )}
    </>
  );
}
