import { useState } from "react";
import { format, eachDayOfInterval, startOfMonth, isBefore, getDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type DiaPendente = {
  data: Date;
  dataFormatada: string;
  diaSemana: string;
  horariosPreenchidos: number;
  horariosFaltantes: number;
};

type Lancamento = {
  id: string;
  data: string;
  horario: string;
  valor_acumulado: number;
};

type DiasPendentesProps = {
  lancamentosMes: Lancamento[];
  tipoOperacional: "A" | "B";
  possuiFechamentoTardio: boolean;
  onSelectDia: (data: Date, lancamentosDia: Lancamento[]) => void;
};

export function DiasPendentes({
  lancamentosMes,
  tipoOperacional,
  possuiFechamentoTardio,
  onSelectDia,
}: DiasPendentesProps) {
  const [isOpen, setIsOpen] = useState(true);

  const calcularDiasPendentes = (): DiaPendente[] => {
    const hoje = new Date();
    const primeiroDiaMes = startOfMonth(hoje);
    const horariosEsperados = possuiFechamentoTardio ? 5 : 4;

    // Gerar todos os dias do mês até ontem
    const diasDoMes = eachDayOfInterval({
      start: primeiroDiaMes,
      end: hoje,
    }).filter((dia) => {
      // Excluir hoje (gerente preenche no fluxo normal)
      if (isToday(dia)) return false;

      // Para tipo B, excluir domingos
      if (tipoOperacional === "B" && getDay(dia) === 0) return false;

      return true;
    });

    const diasPendentes: DiaPendente[] = [];

    diasDoMes.forEach((dia) => {
      const dataStr = format(dia, "yyyy-MM-dd");
      const lancamentosDia = lancamentosMes.filter((l) => l.data === dataStr);

      if (lancamentosDia.length < horariosEsperados) {
        diasPendentes.push({
          data: dia,
          dataFormatada: format(dia, "dd/MM", { locale: ptBR }),
          diaSemana: format(dia, "EEE", { locale: ptBR }),
          horariosPreenchidos: lancamentosDia.length,
          horariosFaltantes: horariosEsperados - lancamentosDia.length,
        });
      }
    });

    return diasPendentes;
  };

  const diasPendentes = calcularDiasPendentes();

  // Se não há dias pendentes, não mostra nada
  if (diasPendentes.length === 0) {
    return null;
  }

  const handleSelectDia = (diaPendente: DiaPendente) => {
    const dataStr = format(diaPendente.data, "yyyy-MM-dd");
    const lancamentosDia = lancamentosMes.filter((l) => l.data === dataStr);
    onSelectDia(diaPendente.data, lancamentosDia);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/20">
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                <CardTitle className="text-base font-semibold text-yellow-800 dark:text-yellow-200">
                  Dias Pendentes
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                >
                  {diasPendentes.length} {diasPendentes.length === 1 ? "dia" : "dias"}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
              Você tem dias anteriores que precisam ser regularizados. Clique em um dia para preencher os lançamentos faltantes.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {diasPendentes.map((dia) => (
                <Button
                  key={dia.dataFormatada}
                  variant="outline"
                  onClick={() => handleSelectDia(dia)}
                  className={cn(
                    "h-auto flex-col gap-1 py-3 px-3",
                    "bg-white dark:bg-card border-yellow-300 dark:border-yellow-700",
                    "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
                    "hover:border-yellow-400 dark:hover:border-yellow-600"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                    <span className="font-bold text-foreground">{dia.dataFormatada}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {dia.diaSemana}
                  </span>
                  <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                    {dia.horariosFaltantes} {dia.horariosFaltantes === 1 ? "horário" : "horários"} faltando
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
