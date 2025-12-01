import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

type PeriodFilterProps = {
  mesSelecionado: number;
  anoSelecionado: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  onResetToAtual: () => void;
  isAtual: boolean;
};

const meses = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export function PeriodFilter({
  mesSelecionado,
  anoSelecionado,
  onMesChange,
  onAnoChange,
  onResetToAtual,
  isAtual,
}: PeriodFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
        <Select
          value={String(mesSelecionado)}
          onValueChange={(value) => onMesChange(Number(value))}
        >
          <SelectTrigger className="w-full sm:w-[140px] bg-card">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {meses.map((mes) => (
              <SelectItem key={mes.value} value={String(mes.value)}>
                {mes.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(anoSelecionado)}
          onValueChange={(value) => onAnoChange(Number(value))}
        >
          <SelectTrigger className="w-full sm:w-[100px] bg-card">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((ano) => (
              <SelectItem key={ano} value={String(ano)}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isAtual && (
        <Button
          variant="outline"
          size="sm"
          onClick={onResetToAtual}
          className="gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          <span>Período Atual</span>
        </Button>
      )}
    </div>
  );
}
