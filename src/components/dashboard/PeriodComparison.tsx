import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { fetchPeriodoCompleto } from "@/lib/fetchAllPaged";
import { cn } from "@/lib/utils";

type ComparisonData = {
  lojaId: string;
  nomeLoja: string;
  percentualA: number;
  percentualB: number;
  variacao: number;
  hasMetaA: boolean;
  hasMetaB: boolean;
};

type LoadingStage = 'idle' | 'lojas' | 'periodoA' | 'periodoB' | 'complete';

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
  const [mesB, setMesB] = useState(() => {
    const mesAtual = new Date().getMonth() + 1; // 1-12
    return mesAtual === 1 ? 12 : mesAtual - 1; // Dezembro se Janeiro
  });
  const [anoB, setAnoB] = useState(() => {
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    return mesAtual === 1 ? anoAtual - 1 : anoAtual; // Ano anterior se Janeiro
  });
  
  // Estado de loading dinâmico
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const anos = getAvailableYears();

  // Reset loading state when periods change
  useEffect(() => {
    setLoadingStage('idle');
    setLoadingProgress(0);
  }, [mesA, anoA, mesB, anoB]);

  // Buscar lojas
  const { data: lojas = [], isLoading: isLoadingLojas } = useQuery({
    queryKey: ["lojas-comparison"],
    queryFn: async () => {
      setLoadingStage('lojas');
      setLoadingProgress(10);
      const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");
      if (error) throw error;
      setLoadingProgress(20);
      return data;
    },
  });

  // Buscar dados do período A (com queries paralelas otimizadas)
  const { data: dataA, isLoading: isLoadingA } = useQuery({
    queryKey: ["comparison-a", mesA, anoA],
    queryFn: async () => {
      setLoadingStage('periodoA');
      setLoadingProgress(35);
      
      const { metas, lancamentos } = await fetchPeriodoCompleto(mesA, anoA);
      
      setLoadingProgress(50);

      const result: Record<string, { meta: number; maxVenda: number }> = {};

      metas.forEach((meta) => {
        result[meta.loja_id] = { meta: meta.meta_diaria_calculada, maxVenda: 0 };
      });

      lancamentos.forEach((lanc) => {
        if (result[lanc.loja_id]) {
          result[lanc.loja_id].maxVenda = Math.max(result[lanc.loja_id].maxVenda, lanc.valor_acumulado);
        }
      });

      return result;
    },
    enabled: lojas.length > 0,
  });

  // Buscar dados do período B (com queries paralelas otimizadas)
  const { data: dataB, isLoading: isLoadingB } = useQuery({
    queryKey: ["comparison-b", mesB, anoB],
    queryFn: async () => {
      setLoadingStage('periodoB');
      setLoadingProgress(70);
      
      const { metas, lancamentos } = await fetchPeriodoCompleto(mesB, anoB);
      
      setLoadingProgress(90);

      const result: Record<string, { meta: number; maxVenda: number }> = {};

      metas.forEach((meta) => {
        result[meta.loja_id] = { meta: meta.meta_diaria_calculada, maxVenda: 0 };
      });

      lancamentos.forEach((lanc) => {
        if (result[lanc.loja_id]) {
          result[lanc.loja_id].maxVenda = Math.max(result[lanc.loja_id].maxVenda, lanc.valor_acumulado);
        }
      });

      setLoadingProgress(100);
      setLoadingStage('complete');

      return result;
    },
    enabled: lojas.length > 0,
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

  const isLoading = isLoadingLojas || isLoadingA || isLoadingB;

  // Componente de Loading Dinâmico
  const LoadingOverlay = () => {
    const stageLabels: Record<LoadingStage, string> = {
      idle: 'Preparando...',
      lojas: 'Carregando farmácias...',
      periodoA: `Carregando ${mesesNomes[Math.max(0, mesA - 1)] || 'período'}/${anoA}...`,
      periodoB: `Carregando ${mesesNomes[Math.max(0, mesB - 1)] || 'período'}/${anoB}...`,
      complete: 'Finalizando...',
    };

    const stages: LoadingStage[] = ['lojas', 'periodoA', 'periodoB'];
    const currentStageIndex = stages.indexOf(loadingStage);

    return (
      <Card className="p-8 animate-fade-in">
        <div className="flex flex-col items-center gap-6">
          {/* Spinner com porcentagem */}
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{loadingProgress}%</span>
            </div>
          </div>
          
          {/* Etapa atual */}
          <div className="text-center space-y-1">
            <p className="text-base font-medium text-foreground">
              {stageLabels[loadingStage]}
            </p>
            <p className="text-xs text-muted-foreground">
              Buscando dados dos períodos selecionados
            </p>
          </div>
          
          {/* Barra de progresso */}
          <div className="w-full max-w-xs space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {loadingProgress}% concluído
            </p>
          </div>
          
          {/* Indicadores de etapa */}
          <div className="flex items-center gap-3 mt-2">
            {stages.map((stage, index) => {
              const isCompleted = currentStageIndex > index || loadingStage === 'complete';
              const isCurrent = loadingStage === stage;
              
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "w-3 h-3 rounded-full transition-all duration-300",
                      isCompleted ? "bg-primary scale-100" : 
                      isCurrent ? "bg-primary animate-pulse scale-110" : 
                      "bg-muted scale-90"
                    )} />
                    <span className={cn(
                      "text-[10px] transition-colors",
                      isCompleted || isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {index === 0 ? "Farmácias" : index === 1 ? "Período A" : "Período B"}
                    </span>
                  </div>
                  {index < stages.length - 1 && (
                    <div className={cn(
                      "w-8 h-0.5 transition-colors duration-300 mb-4",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Seletores de período mesmo durante loading */}
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

        <LoadingOverlay />
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
          <Card key={item.lojaId} className="p-6 animate-fade-in">
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
