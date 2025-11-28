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

  const getStatusColor = () => {
    if (percentualAtingimento >= 100) return "text-green-600 dark:text-green-400";
    if (percentualAtingimento >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBg = () => {
    if (percentualAtingimento >= 100)
      return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
    if (percentualAtingimento >= 80)
      return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800";
    return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
  };

  const getIcon = () => {
    if (percentualAtingimento >= 100)
      return <TrendingUp className="h-12 w-12" />;
    if (percentualAtingimento >= 80)
      return <Minus className="h-12 w-12" />;
    return <TrendingDown className="h-12 w-12" />;
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-6 transition-all hover:scale-105",
        getStatusBg()
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-muted-foreground">
            #{posicao}
          </div>
          <div>
            <h3 className="text-2xl font-bold">{nomeLoja}</h3>
          </div>
        </div>
        <div className={cn("flex items-center", getStatusColor())}>
          {getIcon()}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Meta Diária:</span>
          <span className="text-lg font-semibold">
            {formatCurrency(metaDiaria)}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total Vendido:</span>
          <span className="text-lg font-bold">{formatCurrency(totalVendido)}</span>
        </div>

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Atingimento:</span>
            <span className={cn("text-5xl font-bold", getStatusColor())}>
              {percentualAtingimento.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
