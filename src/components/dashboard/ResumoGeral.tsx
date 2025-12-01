import { TrendingUp, Store } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type ResumoGeralProps = {
  metaTotal: number;
  vendasTotal: number;
  atingimentoGeral: number;
  lojasComMeta: number;
  totalLojas: number;
};

export function ResumoGeral({
  metaTotal,
  vendasTotal,
  atingimentoGeral,
  lojasComMeta,
  totalLojas
}: ResumoGeralProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getStatusColor = () => {
    if (atingimentoGeral >= 100) return "text-green-600";
    if (atingimentoGeral >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBg = () => {
    if (atingimentoGeral >= 100) return "bg-green-50 border-green-200";
    if (atingimentoGeral >= 80) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className={`border rounded-xl p-4 md:p-6 ${getStatusBg()} transition-colors`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-xl md:text-2xl font-semibold">Resumo Geral do Dia</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Meta Total */}
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-1">Meta Total</p>
          <p className="text-2xl font-bold">{formatCurrency(metaTotal)}</p>
        </div>

        {/* Vendas Total */}
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-1">Vendas Totais</p>
          <p className="text-2xl font-bold">{formatCurrency(vendasTotal)}</p>
        </div>

        {/* Atingimento Geral */}
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-1">Atingimento Geral</p>
          <p className={`text-2xl font-bold ${getStatusColor()}`}>
            {atingimentoGeral.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mb-3">
        <Progress value={Math.min(atingimentoGeral, 100)} className="h-3" />
      </div>

      {/* Info Lojas */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Store className="h-4 w-4" />
        <span>
          {lojasComMeta} {lojasComMeta === 1 ? "loja" : "lojas"} com meta configurada de {totalLojas} {totalLojas === 1 ? "loja" : "lojas"} total
        </span>
      </div>
    </div>
  );
}
