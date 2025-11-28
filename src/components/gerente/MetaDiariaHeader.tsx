import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

type MetaDiariaHeaderProps = {
  metaDiaria: number;
  totalVendido: number;
  lojaName: string;
};

export function MetaDiariaHeader({
  metaDiaria,
  totalVendido,
}: MetaDiariaHeaderProps) {
  const percentualAtingimento =
    metaDiaria > 0 ? (totalVendido / metaDiaria) * 100 : 0;
  const progressoVisual = Math.min(percentualAtingimento, 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusColor = () => {
    if (percentualAtingimento >= 100) return "text-green-600 dark:text-green-400";
    if (percentualAtingimento >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="p-6 shadow-md">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Meta Diária</p>
            <p className="text-2xl md:text-3xl font-bold">
              {metaDiaria > 0 ? formatCurrency(metaDiaria) : "—"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Total Vendido</p>
            <p className="text-2xl md:text-3xl font-bold text-primary">
              {formatCurrency(totalVendido)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Atingimento</p>
            <p className={`text-2xl md:text-3xl font-bold ${getStatusColor()}`}>
              {metaDiaria > 0 ? `${percentualAtingimento.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>

        {metaDiaria > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{progressoVisual.toFixed(1)}%</span>
            </div>
            <Progress value={progressoVisual} className="h-3" />
          </div>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-2 border rounded-lg bg-muted/30">
            Meta diária não configurada para este mês
          </p>
        )}
      </div>
    </Card>
  );
}
