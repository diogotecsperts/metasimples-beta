import { cn } from "@/lib/utils";

type RankingCardSimpleProps = {
  posicao: number;
  nomeLoja: string;
  percentualAtingimento: number;
  temMeta: boolean;
};

export function RankingCardSimple({
  posicao,
  nomeLoja,
  percentualAtingimento,
  temMeta,
}: RankingCardSimpleProps) {
  const percentualFormatado = temMeta
    ? `${percentualAtingimento.toFixed(1)}%`
    : "—";

  const getStatusColor = () => {
    if (!temMeta) return "text-gray-400";
    if (percentualAtingimento >= 100) return "text-green-600";
    if (percentualAtingimento >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBg = () => {
    if (!temMeta) return "bg-gray-50 border-gray-200";
    if (percentualAtingimento >= 100) return "bg-green-50 border-green-200";
    if (percentualAtingimento >= 80) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const getStatusCircle = () => {
    if (!temMeta) return "bg-gray-300";
    if (percentualAtingimento >= 100) return "bg-green-500";
    if (percentualAtingimento >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 flex items-center gap-2",
        getStatusBg()
      )}
    >
      <span className="text-sm font-bold text-gray-500">
        #{posicao}
      </span>
      <span className="flex-1 text-xs font-semibold text-gray-800 text-center">
        {nomeLoja}
      </span>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-sm font-bold", getStatusColor())}>
          {percentualFormatado}
        </span>
        <span className={cn("w-2.5 h-2.5 rounded-full", getStatusCircle())} />
      </div>
    </div>
  );
}
