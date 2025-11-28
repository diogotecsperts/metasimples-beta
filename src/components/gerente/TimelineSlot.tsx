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
        "h-auto flex-col gap-2 py-3 md:py-4 px-4 md:px-6 transition-all",
        !isPendente && "border-green-500 bg-green-50 dark:bg-green-950/20"
      )}
    >
      <div className="flex items-center gap-2">
        {isPendente ? (
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        ) : (
          <Check className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
        )}
        <span className="font-semibold text-base md:text-lg">{horario}</span>
      </div>
      {!isPendente && valor !== undefined && (
        <span className="text-xs md:text-sm font-medium text-green-700 dark:text-green-400">
          {formatCurrency(valor)}
        </span>
      )}
      {isPendente && (
        <span className="text-xs text-muted-foreground">Pendente</span>
      )}
    </Button>
  );
}
