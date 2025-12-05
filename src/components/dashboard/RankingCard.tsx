import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type RankingCardProps = {
  posicao: number;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
  tendencia?: number | null;
  isEmAlerta?: boolean;
  ultimaAtualizacao?: string;
  ultimoHorario?: string | null;
};

export function RankingCard({
  posicao,
  nomeLoja,
  metaDiaria,
  totalVendido,
  percentualAtingimento,
  tendencia,
  isEmAlerta = false,
  ultimaAtualizacao,
  ultimoHorario,
}: RankingCardProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const temMeta = metaDiaria > 0;
  const percentualFormatado = temMeta ? `${percentualAtingimento.toFixed(1)}%` : "—";

  const getPercentualFontSize = () => {
    // Casos extremos (7+ caracteres): 1000.0%, 9999.9%, etc
    if (temMeta && percentualFormatado.length >= 7) {
      return "text-2xl md:text-4xl";
    }
    // Padrão para todos os outros casos (incluindo "—")
    return "text-3xl md:text-5xl";
  };

  const getStatusColor = () => {
    if (!temMeta) return "text-muted-foreground";
    if (percentualAtingimento >= 100) return "text-green-600 dark:text-green-400";
    if (percentualAtingimento >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBg = () => {
    if (!temMeta)
      return "bg-muted/50 border-muted-foreground/20";
    if (percentualAtingimento >= 100)
      return "bg-green-50 dark:bg-green-950/20 border-green-500/30";
    if (percentualAtingimento >= 80)
      return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500/30";
    return "bg-red-50 dark:bg-red-950/20 border-red-500/30";
  };

  const getIcon = () => {
    if (!temMeta) return <Minus className="h-10 md:h-14 w-10 md:w-14" />;
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
        getStatusBg(),
        isEmAlerta && "ring-2 ring-red-500 ring-offset-2"
      )}
    >
      {isEmAlerta && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 gap-1 shadow-lg animate-pulse"
        >
          <AlertTriangle className="h-3 w-3" />
          Alerta
        </Badge>
      )}
      
      <div className="flex items-start justify-between mb-4 md:mb-6">
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
          <span className="text-sm md:text-base text-muted-foreground">Meta Diária:</span>
          <span className="text-lg md:text-xl font-semibold">
            {temMeta ? formatCurrency(metaDiaria) : "—"}
          </span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm md:text-base text-muted-foreground">Total Vendido:</span>
          <span className="text-lg md:text-xl font-bold">{formatCurrency(totalVendido)}</span>
        </div>

        <div className="pt-3 md:pt-4 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm md:text-base font-medium">Atingimento:</span>
            <span className={cn(getPercentualFontSize(), "font-bold", getStatusColor())}>
              {percentualFormatado}
            </span>
          </div>

          {/* Indicador de tendência vs dia anterior */}
          {tendencia !== null && tendencia !== undefined && (
            <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border/30">
              {tendencia > 0 ? (
                <>
                  <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    +{tendencia.toFixed(1)}% vs ontem
                  </span>
                </>
              ) : tendencia < 0 ? (
                <>
                  <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {tendencia.toFixed(1)}% vs ontem
                  </span>
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    = vs ontem
                  </span>
                </>
              )}
            </div>
          )}

          {/* Última atualização - exibir apenas se houver dados */}
          {ultimaAtualizacao && (
            <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-border/20">
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                Atualizado às {formatTime(ultimaAtualizacao)}
                {ultimoHorario && ` • ${ultimoHorario}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
