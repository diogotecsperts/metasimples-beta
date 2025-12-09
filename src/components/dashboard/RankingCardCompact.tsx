import { cn } from "@/lib/utils";

type RankingCardCompactProps = {
  posicao: number;
  nomeLoja: string;
  percentualAtingimento: number;
  temMeta: boolean;
  metaDiaria?: number;
  totalVendido?: number;
};

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function RankingCardCompact({
  posicao,
  nomeLoja,
  percentualAtingimento,
  temMeta,
  metaDiaria,
  totalVendido,
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

  const getStatusCircle = () => {
    if (!temMeta) return "bg-gray-400";
    if (percentualAtingimento >= 100) return "bg-green-500";
    if (percentualAtingimento >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  const showFinancials = metaDiaria !== undefined && totalVendido !== undefined;

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 flex flex-col gap-1",
        getStatusBg()
      )}
    >
      {/* Linha 1: Posição, Nome, Percentual */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-bold text-gray-500 flex-shrink-0">
            #{posicao}
          </span>
          <span className="text-xs font-semibold text-gray-800 truncate leading-tight">
            {nomeLoja}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn("text-xs font-bold", getStatusColor())}>
            {percentualFormatado}
          </span>
          <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", getStatusCircle())} />
        </div>
      </div>

      {/* Linha 2: Meta e Vendido */}
      {showFinancials && (
        <div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-gray-200 pt-1">
          <span>Meta: <span className="font-semibold">{formatCurrencyCompact(metaDiaria)}</span></span>
          <span>Vendido: <span className="font-semibold">{formatCurrencyCompact(totalVendido)}</span></span>
        </div>
      )}
    </div>
  );
}
