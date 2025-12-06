import { cn } from "@/lib/utils";

type RankingCardCompactProps = {
  posicao: number;
  nomeLoja: string;
  percentualAtingimento: number;
  temMeta: boolean;
};

export function RankingCardCompact({
  posicao,
  nomeLoja,
  percentualAtingimento,
  temMeta,
}: RankingCardCompactProps) {
  const percentualFormatado = temMeta ? `${percentualAtingimento.toFixed(1)}%` : "—";

  const getStatusColor = () => {
    if (!temMeta) return "text-muted-foreground";
    if (percentualAtingimento >= 100) return "text-green-600";
    if (percentualAtingimento >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBg = () => {
    if (!temMeta) return "bg-gray-100 border-gray-300";
    if (percentualAtingimento >= 100) return "bg-green-50 border-green-400";
    if (percentualAtingimento >= 80) return "bg-yellow-50 border-yellow-400";
    return "bg-red-50 border-red-400";
  };

  const getStatusEmoji = () => {
    if (!temMeta) return "⚪";
    if (percentualAtingimento >= 100) return "🟢";
    if (percentualAtingimento >= 80) return "🟡";
    return "🔴";
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 flex items-center justify-between gap-2",
        getStatusBg()
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-lg font-bold text-gray-500 flex-shrink-0">
          #{posicao}
        </span>
        <span className="text-sm font-semibold truncate text-gray-800">
          {nomeLoja}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={cn("text-base font-bold", getStatusColor())}>
          {percentualFormatado}
        </span>
        <span className="text-sm">{getStatusEmoji()}</span>
      </div>
    </div>
  );
}
