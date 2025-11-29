import { Check, Clock, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimelineSlotProps = {
  horario: string;
  valor?: number;
  isPendente: boolean;
  isAtrasado?: boolean;
  isProximoDeVencer?: boolean;
  isBlocked?: boolean;
  onClick: () => void;
};

export function TimelineSlot({
  horario,
  valor,
  isPendente,
  isAtrasado = false,
  isProximoDeVencer = false,
  isBlocked = false,
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
      onClick={isBlocked ? undefined : onClick}
      disabled={isBlocked}
      className={cn(
        "h-auto flex-col gap-3 py-4 px-4 md:px-6 transition-all shadow-sm hover:shadow-md",
        !isPendente && "bg-green-50 dark:bg-green-950/20 border-green-500 hover:bg-green-100 dark:hover:bg-green-950/30",
        isAtrasado && "bg-red-50 dark:bg-red-950/20 border-red-500 hover:bg-red-100 dark:hover:bg-red-950/30",
        isProximoDeVencer && "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-950/30",
        isBlocked && "opacity-50 cursor-not-allowed bg-muted hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-2">
        {isBlocked ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : !isPendente ? (
          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : isAtrasado ? (
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : isProximoDeVencer ? (
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="font-bold text-lg">{horario}</span>
      </div>
      {!isPendente && valor !== undefined && (
        <span className="text-sm font-semibold text-green-700 dark:text-green-400">
          {formatCurrency(valor)}
        </span>
      )}
      {isBlocked && (
        <span className="text-xs text-muted-foreground">Preencha os anteriores</span>
      )}
      {isPendente && !isBlocked && !isAtrasado && !isProximoDeVencer && (
        <span className="text-xs text-muted-foreground">Clique para lançar</span>
      )}
      {isProximoDeVencer && !isBlocked && (
        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Prestes a vencer</span>
      )}
      {isAtrasado && !isBlocked && (
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">Atrasado</span>
      )}
    </Button>
  );
}
