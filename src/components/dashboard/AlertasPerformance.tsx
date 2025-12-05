import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type LojaEmAlerta = {
  nome: string;
  percentual: number;
};

type AlertasPerformanceProps = {
  isAtual: boolean;
  lojasEmAlerta: LojaEmAlerta[];
};

export function AlertasPerformance({ isAtual, lojasEmAlerta }: AlertasPerformanceProps) {
  // Verifica se está no horário de alerta (após 16:00)
  const isHorarioAlerta = () => {
    const agora = new Date();
    const hora = agora.getHours();
    return hora >= 16 && hora < 23;
  };

  const shouldShowAlert = isAtual && isHorarioAlerta() && lojasEmAlerta.length > 0;

  if (!shouldShowAlert) return null;

  return (
    <Alert variant="destructive" className="border-2 shadow-lg animate-in fade-in slide-in-from-top-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">
        ⚠️ Atenção: {lojasEmAlerta.length} {lojasEmAlerta.length === 1 ? "loja está" : "lojas estão"} abaixo de 70% da meta
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2 text-sm">
          As seguintes lojas estão com atingimento crítico. Considere ações para recuperar a meta:
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
