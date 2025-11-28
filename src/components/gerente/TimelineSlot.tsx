import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimelineSlotProps = {
  horario: string;
  valor?: number;
  isPendente: boolean;
  onClick: () => void;
};

export function TimelineSlot({
  horario,
  valor,
  isPendente,
  onClick,
}: TimelineSlotProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-auto flex-col gap-3 py-4 px-4 md:px-6 transition-all shadow-sm hover:shadow-md",
        !isPendente && "bg-green-50 dark:bg-green-950/20 border-green-500 hover:bg-green-100 dark:hover:bg-green-950/30"
      )}
    >
      <div className="flex items-center gap-2">
        {isPendente ? (
          <Clock className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
        )}
        <span className="font-bold text-lg">{horario}</span>
      </div>
      {!isPendente && valor !== undefined && (
        <span className="text-sm font-semibold text-green-700 dark:text-green-400">
          {formatCurrency(valor)}
        </span>
      )}
      {isPendente && (
        <span className="text-xs text-muted-foreground">Clique para lançar</span>
      )}
    </Button>
  );
}
