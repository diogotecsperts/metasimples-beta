import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { fetchLancamentosMensais } from "@/lib/fetchAllPaged";

type ComparisonData = {
  lojaId: string;
  nomeLoja: string;
  percentualA: number;
  percentualB: number;
  variacao: number;
  hasMetaA: boolean;
  hasMetaB: boolean;
};

const mesesNomes = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const getAvailableYears = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear];
};

export function PeriodComparison() {
  const [mesA, setMesA] = useState(new Date().getMonth() + 1);
  const [anoA, setAnoA] = useState(new Date().getFullYear());
  const [mesB, setMesB] = useState(new Date().getMonth());
  const [anoB, setAnoB] = useState(new Date().getFullYear());

  const anos = getAvailableYears();

  // Buscar lojas
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar dados do período A (com paginação para evitar limite de 1000)
  const { data: dataA } = useQuery({
    queryKey: ["comparison-a", mesA, anoA],
    queryFn: async () => {
      const { data: metas } = await supabase
        .from("metas_mensais")
        .select("loja_id, meta_diaria_calculada")
        .eq("mes", mesA)
        .eq("ano", anoA);

      const inicioMes = `${anoA}-${String(mesA).padStart(2, "0")}-01`;
      const fimMes = format(endOfMonth(new Date(anoA, mesA - 1)), "yyyy-MM-dd");

      const lancamentos = await fetchLancamentosMensais(inicioMes, fimMes);

      const result: Record<string, { meta: number; maxVenda: number }> = {};

      metas?.forEach((meta) => {
        result[meta.loja_id] = { meta: meta.meta_diaria_calculada, maxVenda: 0 };
      });

      lancamentos?.forEach((lanc) => {
        if (result[lanc.loja_id]) {
          result[lanc.loja_id].maxVenda = Math.max(result[lanc.loja_id].maxVenda, lanc.valor_acumulado);
        }
      });

      return result;
    },
  });

  // Buscar dados do período B (com paginação para evitar limite de 1000)
  const { data: dataB, isLoading } = useQuery({
    queryKey: ["comparison-b", mesB, anoB],
    queryFn: async () => {
      const { data: metas } = await supabase
        .from("metas_mensais")
        .select("loja_id, meta_diaria_calculada")
        .eq("mes", mesB)
        .eq("ano", anoB);

      const inicioMes = `${anoB}-${String(mesB).padStart(2, "0")}-01`;
      const fimMes = format(endOfMonth(new Date(anoB, mesB - 1)), "yyyy-MM-dd");

      const lancamentos = await fetchLancamentosMensais(inicioMes, fimMes);

      const result: Record<string, { meta: number; maxVenda: number }> = {};

      metas?.forEach((meta) => {
        result[meta.loja_id] = { meta: meta.meta_diaria_calculada, maxVenda: 0 };
      });

      lancamentos?.forEach((lanc) => {
        if (result[lanc.loja_id]) {
          result[lanc.loja_id].maxVenda = Math.max(result[lanc.loja_id].maxVenda, lanc.valor_acumulado);
        }
      });

      return result;
    },
  });

  // Processar dados de comparação
  const comparisonData: ComparisonData[] = lojas
    .map((loja) => {
      const dadosA = dataA?.[loja.id];
      const dadosB = dataB?.[loja.id];

      const percentualA = dadosA && dadosA.meta > 0 ? (dadosA.maxVenda / dadosA.meta) * 100 : 0;
      const percentualB = dadosB && dadosB.meta > 0 ? (dadosB.maxVenda / dadosB.meta) * 100 : 0;
      const variacao = percentualA - percentualB;

      return {
        lojaId: loja.id,
        nomeLoja: loja.nome,
        percentualA,
        percentualB,
        variacao,
        hasMetaA: !!dadosA,
        hasMetaB: !!dadosB,
      };
    })
    .sort((a, b) => b.variacao - a.variacao);

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 5) return "text-green-600";
    if (variacao < -5) return "text-red-600";
    return "text-muted-foreground";
  };

  const getVariacaoIcon = (variacao: number) => {
    if (variacao > 5) return <TrendingUp className="h-5 w-5" />;
    if (variacao < -5) return <TrendingDown className="h-5 w-5" />;
    return <Minus className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Comparação entre Períodos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Período A */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Período A</h4>
            <div className="flex gap-3">
              <Select value={String(mesA)} onValueChange={(v) => setMesA(parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesNomes.map((mes, index) => (
                    <SelectItem key={index} value={String(index + 1)}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(anoA)} onValueChange={(v) => setAnoA(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Período B */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Período B</h4>
            <div className="flex gap-3">
              <Select value={String(mesB)} onValueChange={(v) => setMesB(parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesNomes.map((mes, index) => (
                    <SelectItem key={index} value={String(index + 1)}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(anoB)} onValueChange={(v) => setAnoB(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparisonData.map((item) => (
          <Card key={item.lojaId} className="p-6">
            <h4 className="font-semibold text-lg mb-4">{item.nomeLoja}</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {mesesNomes[mesA - 1]}/{anoA}
                </span>
                <span className="text-lg font-semibold">
                  {item.hasMetaA ? `${item.percentualA.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {mesesNomes[mesB - 1]}/{anoB}
                </span>
                <span className="text-lg font-semibold">
                  {item.hasMetaB ? `${item.percentualB.toFixed(1)}%` : "—"}
                </span>
              </div>
              {item.hasMetaA && item.hasMetaB && (
                <div
                  className={`flex items-center justify-between pt-3 border-t ${getVariacaoColor(
                    item.variacao
                  )}`}
                >
                  <span className="text-sm font-medium">Variação</span>
                  <div className="flex items-center gap-2">
                    {getVariacaoIcon(item.variacao)}
                    <span className="text-xl font-bold">
                      {item.variacao > 0 ? "+" : ""}
                      {item.variacao.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
              {(!item.hasMetaA || !item.hasMetaB) && (
                <div className="pt-3 border-t text-sm text-muted-foreground text-center">
                  Sem meta em um dos períodos
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
