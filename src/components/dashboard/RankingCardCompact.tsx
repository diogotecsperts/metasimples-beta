import { cn } from "@/lib/utils";

type RankingCardCompactProps = {
  posicao: number;
  nomeLoja: string;
  percentualAtingimento: number;
  temMeta: boolean;
  metaDiaria?: number;
  totalVendido?: number;
  faltanteDiario?: number;
  faltanteMensal?: number;
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
  faltanteDiario,
  faltanteMensal,
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
  const showFaltantes = faltanteDiario !== undefined && faltanteMensal !== undefined;

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 flex flex-col gap-0.5",
        getStatusBg()
      )}
    >
      {/* Linha 1: Posição à esquerda, Percentual à direita */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-500">
          #{posicao}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-bold", getStatusColor())}>
            {percentualFormatado}
          </span>
          <span className={cn("w-2.5 h-2.5 rounded-full", getStatusCircle())} />
        </div>
      </div>

      {/* Linha 2: Nome centralizado */}
      <span className="text-xs font-semibold text-gray-800 text-center leading-tight">
        {nomeLoja}
      </span>

      {/* Linha 3: Meta e Vendido */}
      {showFinancials && (
        <div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-gray-200 pt-1 mt-0.5">
          <span>Meta: <span className="font-semibold">{formatCurrencyCompact(metaDiaria)}</span></span>
          <span>Vendido: <span className="font-semibold">{formatCurrencyCompact(totalVendido)}</span></span>
        </div>
      )}

      {/* Linha 4: Faltante Diário e Faltante Mensal (somente mensal) */}
      {showFaltantes && (
        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
          <div className="flex flex-col leading-tight">
            <span>Faltante Diário:</span>
            <span className={cn("font-semibold", faltanteDiario === 0 && "text-green-600")}>
              {formatCurrencyCompact(faltanteDiario)}
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span>Faltante Mensal:</span>
            <span className={cn("font-semibold", faltanteMensal === 0 && "text-green-600")}>
              {formatCurrencyCompact(faltanteMensal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
