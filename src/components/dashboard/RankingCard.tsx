import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type RankingCardProps = {
  posicao: number;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
};

export function RankingCard({
  posicao,
  nomeLoja,
  metaDiaria,
  totalVendido,
  percentualAtingimento,
}: RankingCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const temMeta = metaDiaria > 0;

  const getStatusColor = () => {
    if (!temMeta) return "text-muted-foreground";
    if (percentualAtingimento >= 100) return "text-green-600 dark:text-green-400";
    if (percentualAtingimento >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBg = () => {
    if (!temMeta)
      return "bg-muted/30 border-muted";
    if (percentualAtingimento >= 100)
      return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
    if (percentualAtingimento >= 80)
      return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800";
    return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
  };

  const getIcon = () => {
    if (!temMeta) return <Minus className="h-8 md:h-12 w-8 md:w-12" />;
    if (percentualAtingimento >= 100)
      return <TrendingUp className="h-8 md:h-12 w-8 md:w-12" />;
    if (percentualAtingimento >= 80)
      return <Minus className="h-8 md:h-12 w-8 md:w-12" />;
    return <TrendingDown className="h-8 md:h-12 w-8 md:w-12" />;
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 md:p-6 transition-all hover:scale-105",
        getStatusBg()
      )}
    >
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-2xl md:text-4xl font-bold text-muted-foreground">
            #{posicao}
          </div>
          <div>
            <h3 className="text-lg md:text-2xl font-bold break-words">{nomeLoja}</h3>
          </div>
        </div>
        <div className={cn("flex items-center flex-shrink-0", getStatusColor())}>
          {getIcon()}
        </div>
      </div>

      <div className="space-y-2 md:space-y-3">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-xs md:text-sm text-muted-foreground">Meta Diária:</span>
          <span className="text-sm md:text-lg font-semibold">
            {temMeta ? formatCurrency(metaDiaria) : "—"}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-xs md:text-sm text-muted-foreground">Total Vendido:</span>
          <span className="text-sm md:text-lg font-bold">{formatCurrency(totalVendido)}</span>
        </div>

        <div className="pt-2 md:pt-3 border-t">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-medium">Atingimento:</span>
            <span className={cn("text-3xl md:text-5xl font-bold", getStatusColor())}>
              {temMeta ? `${percentualAtingimento.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
