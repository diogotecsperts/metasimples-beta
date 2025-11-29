import { forwardRef } from "react";
import { Area, AreaChart, XAxis, YAxis, ReferenceLine, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

type Lancamento = {
  horario: string;
  valor_acumulado: number;
};

type SalesEvolutionChartProps = {
  lancamentos: Lancamento[];
  metaDiaria: number;
  horarios: string[];
};

export const SalesEvolutionChart = forwardRef<HTMLDivElement, SalesEvolutionChartProps>(
  ({ lancamentos, metaDiaria, horarios }, ref) => {
  // Preparar dados para o gráfico
  const chartData = horarios.map(horario => {
    const lancamento = lancamentos.find(l => l.horario === horario);
    return {
      horario,
      valor: lancamento?.valor_acumulado || null,
    };
  });

  const chartConfig = {
    valor: {
      label: "Vendas Acumuladas",
      color: "hsl(var(--primary))",
    },
  };

  // Verificar se há dados
  const hasData = lancamentos.length > 0;

  return (
    <Card ref={ref} className="p-4 md:p-6 shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Evolução das Vendas</h3>
      </div>
      
      {hasData ? (
        <ChartContainer config={chartConfig} className="h-[200px] md:h-[250px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillVendas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="horario" 
              tickLine={false} 
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <ChartTooltip 
              content={<ChartTooltipContent 
                formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
              />} 
            />
            {metaDiaria > 0 && (
              <ReferenceLine 
                y={metaDiaria} 
                stroke="hsl(var(--destructive))" 
                strokeDasharray="5 5"
                label={{ value: 'Meta', position: 'right', fontSize: 12 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="valor"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#fillVendas)"
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          Nenhum lançamento registrado ainda
        </div>
      )}
    </Card>
  );
});

SalesEvolutionChart.displayName = "SalesEvolutionChart";
