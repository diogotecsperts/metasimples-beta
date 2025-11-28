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
    ? Math.min((totalVendido / metaDiaria) * 100, 100) 
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="bg-card border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{lojaName}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <TrendingUp className="h-8 w-8 text-primary" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Meta Diária</p>
          <p className="text-2xl font-bold">{formatCurrency(metaDiaria)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Vendido</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalVendido)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Atingimento</p>
          <p className="text-2xl font-bold">
            {percentualAtingimento.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">
            {formatCurrency(totalVendido)} / {formatCurrency(metaDiaria)}
          </span>
        </div>
        <Progress value={percentualAtingimento} className="h-3" />
      </div>
    </div>
  );
}
