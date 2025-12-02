import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type LojaEvolution = {
  lojaId: string;
  nomeLoja: string;
  color: string;
  visible: boolean;
};

const CHART_COLORS = [
  "#3b82f6", // azul
  "#22c55e", // verde
  "#f59e0b", // laranja
  "#ef4444", // vermelho
  "#a855f7", // roxo
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#f97316", // laranja escuro
  "#10b981", // esmeralda
  "#06b6d4", // ciano
];

export function MonthlyEvolutionChart() {
  const [lojasVisibility, setLojasVisibility] = useState<Record<string, boolean>>({});

  // Calcular últimos 6 meses
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        mes: date.getMonth() + 1,
        ano: date.getFullYear(),
        label: format(date, "MMM/yy", { locale: ptBR }),
      });
    }
    return months;
  };

  const last6Months = getLast6Months();

  // Buscar lojas
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-evolucao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar dados dos últimos 6 meses
  const { data: evolutionData, isLoading } = useQuery({
    queryKey: ["evolution-data", last6Months],
    queryFn: async () => {
      const results = [];

      for (const month of last6Months) {
        // Buscar metas do mês
        const { data: metas } = await supabase
          .from("metas_mensais")
          .select("loja_id, meta_diaria_calculada")
          .eq("mes", month.mes)
          .eq("ano", month.ano);

        // Buscar lançamentos do mês
        const inicioMes = `${month.ano}-${String(month.mes).padStart(2, "0")}-01`;
        const fimMes = format(
          new Date(month.ano, month.mes, 0),
          "yyyy-MM-dd"
        );

        const { data: lancamentos } = await supabase
          .from("lancamentos_diarios")
          .select("loja_id, valor_acumulado")
          .gte("data", inicioMes)
          .lte("data", fimMes);

        // Agrupar por loja
        const lojaData: Record<string, { meta: number; maxVenda: number }> = {};

        metas?.forEach((meta) => {
          lojaData[meta.loja_id] = {
            meta: meta.meta_diaria_calculada,
            maxVenda: 0,
          };
        });

        lancamentos?.forEach((lanc) => {
          if (lojaData[lanc.loja_id]) {
            lojaData[lanc.loja_id].maxVenda = Math.max(
              lojaData[lanc.loja_id].maxVenda,
              lanc.valor_acumulado
            );
          }
        });

        // Calcular percentuais
        const monthResult: any = { month: month.label };
        Object.entries(lojaData).forEach(([lojaId, data]) => {
          const percentual = data.meta > 0 ? (data.maxVenda / data.meta) * 100 : 0;
          monthResult[lojaId] = parseFloat(percentual.toFixed(1));
        });

        results.push(monthResult);
      }

      return results;
    },
    enabled: lojas.length > 0,
  });

  // Configurar cores das lojas
  const lojasConfig: LojaEvolution[] = lojas.map((loja, index) => ({
    lojaId: loja.id,
    nomeLoja: loja.nome,
    color: CHART_COLORS[index % CHART_COLORS.length],
    visible: lojasVisibility[loja.id] !== false,
  }));

  const toggleLojaVisibility = (lojaId: string) => {
    setLojasVisibility((prev) => ({
      ...prev,
      [lojaId]: prev[lojaId] === false ? true : false,
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Evolução de Performance - Últimos 6 Meses</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={evolutionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: any) => [`${value}%`, ""]}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            {lojasConfig
              .filter((loja) => loja.visible)
              .map((loja) => (
                <Line
                  key={loja.lojaId}
                  type="monotone"
                  dataKey={loja.lojaId}
                  name={loja.nomeLoja}
                  stroke={loja.color}
                  strokeWidth={2}
                  dot={{ fill: loja.color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h4 className="text-sm font-medium mb-4">Exibir/Ocultar Lojas</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {lojasConfig.map((loja) => (
            <div key={loja.lojaId} className="flex items-center space-x-2">
              <Checkbox
                id={loja.lojaId}
                checked={loja.visible}
                onCheckedChange={() => toggleLojaVisibility(loja.lojaId)}
              />
              <label
                htmlFor={loja.lojaId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: loja.color }}
                />
                {loja.nomeLoja}
              </label>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
