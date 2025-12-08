import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type RankingCardMensalProps = {
  posicao: number;
  nomeLoja: string;
  metaMensal: number | null;
  totalVendidoMes: number;
  percentualAtingimento: number | null;
};

export function RankingCardMensal({
  posicao,
  nomeLoja,
  metaMensal,
  totalVendidoMes,
  percentualAtingimento,
}: RankingCardMensalProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const temMeta = metaMensal !== null && metaMensal > 0;
  const percentualFormatado = temMeta && percentualAtingimento !== null 
    ? `${percentualAtingimento.toFixed(1)}%` 
    : "—";

  const getPercentualFontSize = () => {
    if (temMeta && percentualFormatado.length >= 7) {
      return "text-2xl md:text-4xl";
    }
    return "text-3xl md:text-5xl";
  };

  const getStatusColor = () => {
    if (!temMeta || percentualAtingimento === null) return "text-muted-foreground";
    if (percentualAtingimento >= 100) return "text-green-600 dark:text-green-400";
    if (percentualAtingimento >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBg = () => {
    if (!temMeta || percentualAtingimento === null)
      return "bg-muted/50 border-muted-foreground/20";
    if (percentualAtingimento >= 100)
      return "bg-green-50 dark:bg-green-950/20 border-green-500/30";
    if (percentualAtingimento >= 80)
      return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500/30";
    return "bg-red-50 dark:bg-red-950/20 border-red-500/30";
  };

  const getIcon = () => {
    if (!temMeta || percentualAtingimento === null) 
      return <Minus className="h-10 md:h-14 w-10 md:w-14" />;
    if (percentualAtingimento >= 100)
      return <TrendingUp className="h-10 md:h-14 w-10 md:w-14" />;
    if (percentualAtingimento >= 80)
      return <Minus className="h-10 md:h-14 w-10 md:w-14" />;
    return <TrendingDown className="h-10 md:h-14 w-10 md:w-14" />;
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-6 md:p-8 transition-all shadow-md hover:shadow-lg relative",
        getStatusBg()
      )}
    >
      {/* Badge indicando visão mensal */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-sm">
        <Calendar className="h-3 w-3" />
        Mensal
      </div>

      <div className="flex items-start justify-between mb-4 md:mb-6 mt-2">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-3xl md:text-5xl font-bold text-muted-foreground/60">
            #{posicao}
          </div>
          <div>
            <h3 className="text-xl md:text-3xl font-bold break-words leading-tight">
              {nomeLoja}
            </h3>
          </div>
        </div>
        <div className={cn("flex items-center flex-shrink-0", getStatusColor())}>
          {getIcon()}
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm md:text-base text-muted-foreground">Meta Mensal:</span>
          <span className="text-lg md:text-xl font-semibold">
            {temMeta ? formatCurrency(metaMensal!) : "—"}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm md:text-base text-muted-foreground">Total Acumulado:</span>
          <span className="text-lg md:text-xl font-bold">{formatCurrency(totalVendidoMes)}</span>
        </div>

        <div className="pt-3 md:pt-4 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm md:text-base font-medium">Atingimento:</span>
            <span className={cn(getPercentualFontSize(), "font-bold", getStatusColor())}>
              {percentualFormatado}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
