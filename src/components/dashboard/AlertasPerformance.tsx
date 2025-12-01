import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type LojaComMeta = {
  id: string;
  nome: string;
  meta_diaria: number;
};

type Lancamento16h = {
  loja_id: string;
  valor_acumulado: number;
};

type AlertasPerformanceProps = {
  isAtual: boolean;
  lojas: LojaComMeta[];
};

export function AlertasPerformance({ isAtual, lojas }: AlertasPerformanceProps) {
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  
  // Verifica se está no horário de alerta (após 16:00)
  const isHorarioAlerta = () => {
    const agora = new Date();
    const hora = agora.getHours();
    return hora >= 16 && hora < 23;
  };

  const shouldShowAlert = isAtual && isHorarioAlerta();

  // Buscar lançamentos das 16:00
  const { data: lancamentos16h = [] } = useQuery({
    queryKey: ["lancamentos-16h", dataHoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("loja_id, valor_acumulado")
        .eq("data", dataHoje)
        .eq("horario", "16:00");

      if (error) throw error;
      return data as Lancamento16h[];
    },
    enabled: shouldShowAlert,
  });

  if (!shouldShowAlert) return null;

  // Calcular lojas em alerta (< 70%)
  const lojasEmAlerta = lojas
    .map((loja) => {
      const lancamento = lancamentos16h.find((l) => l.loja_id === loja.id);
      const valorAtual = lancamento?.valor_acumulado || 0;
      const percentual = loja.meta_diaria > 0 ? (valorAtual / loja.meta_diaria) * 100 : 0;

      return {
        nome: loja.nome,
        percentual,
        temMeta: loja.meta_diaria > 0,
      };
    })
    .filter((loja) => loja.temMeta && loja.percentual > 0 && loja.percentual < 70)
    .sort((a, b) => a.percentual - b.percentual);

  if (lojasEmAlerta.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-2 shadow-lg animate-in fade-in slide-in-from-top-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">
        ⚠️ Atenção: {lojasEmAlerta.length} {lojasEmAlerta.length === 1 ? "loja está" : "lojas estão"} abaixo de 70% da meta
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2 text-sm">
          As seguintes lojas estão com atingimento crítico às 16:00. Considere ações para recuperar a meta:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {lojasEmAlerta.map((loja) => (
            <li key={loja.nome}>
              <strong>{loja.nome}</strong> - {loja.percentual.toFixed(1)}% atingido
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
