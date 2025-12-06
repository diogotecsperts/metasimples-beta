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
    if (!temMeta) return "text-gray-500";
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

  // Usar círculos CSS em vez de emojis para melhor renderização no html2canvas
  const getStatusCircle = () => {
    if (!temMeta) return "bg-gray-400";
    if (percentualAtingimento >= 100) return "bg-green-500";
    if (percentualAtingimento >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-4 py-3 flex items-center justify-between gap-3",
        getStatusBg()
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base font-bold text-gray-500 flex-shrink-0">
          #{posicao}
        </span>
        <span className="text-sm font-semibold text-gray-800 break-words leading-tight">
          {nomeLoja}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn("text-sm font-bold", getStatusColor())}>
          {percentualFormatado}
        </span>
        <span className={cn("w-3 h-3 rounded-full flex-shrink-0", getStatusCircle())} />
      </div>
    </div>
  );
}
