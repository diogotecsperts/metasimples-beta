import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

type MetaDiariaHeaderProps = {
  metaDiaria: number;
  totalVendido: number;
  lojaName: string;
};

export function MetaDiariaHeader({
  metaDiaria,
  totalVendido,
  lojaName,
}: MetaDiariaHeaderProps) {
  const percentualAtingimento = metaDiaria > 0 
    ? (totalVendido / metaDiaria) * 100
    : 0;
  
  // Limitar progresso visual a 100% na barra
  const progressoVisual = Math.min(percentualAtingimento, 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">{lojaName}</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-primary" />
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div>
          <p className="text-xs md:text-sm text-muted-foreground">Meta Diária</p>
          <p className="text-lg md:text-2xl font-bold">
            {metaDiaria > 0 ? formatCurrency(metaDiaria) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs md:text-sm text-muted-foreground">Total Vendido</p>
          <p className="text-lg md:text-2xl font-bold text-primary">
            {formatCurrency(totalVendido)}
          </p>
        </div>
        <div>
          <p className="text-xs md:text-sm text-muted-foreground">Atingimento</p>
          <p className="text-lg md:text-2xl font-bold">
            {metaDiaria > 0 ? `${percentualAtingimento.toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>

      {metaDiaria > 0 ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">
              {formatCurrency(totalVendido)} / {formatCurrency(metaDiaria)}
            </span>
          </div>
          <Progress value={progressoVisual} className="h-2 md:h-3" />
        </div>
      ) : (
        <div className="text-center py-2 text-sm text-muted-foreground">
          Meta diária não configurada para este mês
        </div>
      )}
    </div>
  );
}
