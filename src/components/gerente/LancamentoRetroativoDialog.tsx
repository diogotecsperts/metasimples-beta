import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Check, Clock, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LancamentoDialog } from "./LancamentoDialog";

type Lancamento = {
  id: string;
  horario: string;
  valor_acumulado: number;
};

type LancamentoRetroativoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  data: Date;
  lancamentosDia: Lancamento[];
  horarios: string[];
  onSubmit: (horario: string, valor: number) => Promise<void>;
  isSubmitting: boolean;
};

export function LancamentoRetroativoDialog({
  isOpen,
  onClose,
  data,
  lancamentosDia,
  horarios,
  onSubmit,
  isSubmitting,
}: LancamentoRetroativoDialogProps) {
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);

  const dataFormatada = format(data, "dd 'de' MMMM", { locale: ptBR });
  const diaSemana = format(data, "EEEE", { locale: ptBR });

  const getLancamentoByHorario = (horario: string) => {
    return lancamentosDia.find((l) => l.horario === horario);
  };

  const isHorarioBloqueado = (horario: string): boolean => {
    const indexHorario = horarios.indexOf(horario);

    // Primeiro horário nunca está bloqueado
    if (indexHorario === 0) return false;

    // Verificar se todos os horários anteriores foram preenchidos
    for (let i = 0; i < indexHorario; i++) {
      const horarioAnterior = horarios[i];
      const lancamentoAnterior = getLancamentoByHorario(horarioAnterior);

      if (!lancamentoAnterior) {
        return true; // Bloqueado - horário anterior não preenchido
      }
    }

    return false; // Liberado - todos os anteriores preenchidos
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSlotClick = (horario: string) => {
    const lancamento = getLancamentoByHorario(horario);
    // Só permite abrir se não está preenchido e não está bloqueado
    if (!lancamento && !isHorarioBloqueado(horario)) {
      setSelectedHorario(horario);
    }
  };

  const handleSubmitLancamento = async (valor: number) => {
    if (!selectedHorario) return;
    await onSubmit(selectedHorario, valor);
    setSelectedHorario(null);
  };

  const horariosPreenchidos = lancamentosDia.length;
  const horariosFaltantes = horarios.length - horariosPreenchidos;

  return (
    <>
      <Dialog open={isOpen && !selectedHorario} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="secondary"
                className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 gap-1"
              >
                <CalendarClock className="h-3 w-3" />
                Lançamento Retroativo
              </Badge>
            </div>
            <DialogTitle className="text-xl capitalize">
              {diaSemana}, {dataFormatada}
            </DialogTitle>
            <DialogDescription>
              Preencha os lançamentos faltantes para este dia. Horários já preenchidos não podem ser alterados.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-muted-foreground">
                {horariosPreenchidos} de {horarios.length} horários preenchidos
              </span>
              {horariosFaltantes > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  {horariosFaltantes} faltando
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {horarios.map((horario) => {
                const lancamento = getLancamentoByHorario(horario);
                const isPreenchido = !!lancamento;
                const isBloqueado = !isPreenchido && isHorarioBloqueado(horario);

                return (
                  <Button
                    key={horario}
                    variant="outline"
                    onClick={() => handleSlotClick(horario)}
                    disabled={isPreenchido || isBloqueado}
                    className={cn(
                      "h-auto flex-col gap-2 py-3 px-4 transition-all",
                      isPreenchido &&
                        "bg-green-50 dark:bg-green-950/20 border-green-500 cursor-default opacity-100",
                      isBloqueado && "opacity-50 cursor-not-allowed bg-muted",
                      !isPreenchido &&
                        !isBloqueado &&
                        "hover:bg-yellow-50 dark:hover:bg-yellow-950/20 hover:border-yellow-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isPreenchido ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : isBloqueado ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                      )}
                      <span className="font-bold">{horario}</span>
                    </div>

                    {isPreenchido && lancamento && (
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                        {formatCurrency(lancamento.valor_acumulado)}
                      </span>
                    )}

                    {isBloqueado && (
                      <span className="text-xs text-muted-foreground">
                        Preencha os anteriores
                      </span>
                    )}

                    {!isPreenchido && !isBloqueado && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">
                        Clique para preencher
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedHorario && (
        <LancamentoDialog
          isOpen={!!selectedHorario}
          onClose={() => setSelectedHorario(null)}
          horario={selectedHorario}
          valorAtual={undefined}
          onSubmit={handleSubmitLancamento}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
