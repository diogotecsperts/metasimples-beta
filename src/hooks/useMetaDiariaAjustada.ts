import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  calcularMetasDiariasComAjustes, 
  getMetaDiariaPorData,
  type AjusteDiario,
  type MetaCalculadaPorDia,
} from "@/lib/calcularMetaDiariaComAjustes";

type UseMetaDiariaAjustadaParams = {
  lojaId: string | null;
  tipoOperacional: "A" | "B";
  mes: number;
  ano: number;
  enabled?: boolean;
};

type UseMetaDiariaAjustadaResult = {
  metaHoje: number;
  metaHojeInfo: MetaCalculadaPorDia | null;
  todasMetas: MetaCalculadaPorDia[];
  ajustes: AjusteDiario[];
  metaMensal: number;
  metaMensalId: string | null;
  isLoading: boolean;
  isError: boolean;
};

/**
 * Hook para buscar a meta diária considerando ajustes manuais.
 */
export function useMetaDiariaAjustada({
  lojaId,
  tipoOperacional,
  mes,
  ano,
  enabled = true,
}: UseMetaDiariaAjustadaParams): UseMetaDiariaAjustadaResult {
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  // Buscar meta mensal
  const { data: metaMensalData, isLoading: isLoadingMeta, isError: isErrorMeta } = useQuery({
    queryKey: ["meta-mensal-completa", lojaId, mes, ano],
    queryFn: async () => {
      if (!lojaId) return null;

      const { data, error } = await supabase
        .from("metas_mensais")
        .select("id, meta_mensal, meta_diaria_calculada")
        .eq("loja_id", lojaId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!lojaId,
  });

  // Buscar ajustes manuais
  const { data: ajustes = [], isLoading: isLoadingAjustes, isError: isErrorAjustes } = useQuery({
    queryKey: ["metas-diarias-ajustes", metaMensalData?.id],
    queryFn: async () => {
      if (!metaMensalData?.id) return [];

      const { data, error } = await supabase
        .from("metas_diarias_ajustes")
        .select("*")
        .eq("meta_mensal_id", metaMensalData.id);

      if (error) throw error;
      return data as AjusteDiario[];
    },
    enabled: enabled && !!metaMensalData?.id,
  });

  // Calcular metas com ajustes
  const todasMetas = metaMensalData
    ? calcularMetasDiariasComAjustes(
        metaMensalData.meta_mensal,
        tipoOperacional,
        mes,
        ano,
        ajustes
      )
    : [];

  const metaHojeInfo = metaMensalData
    ? getMetaDiariaPorData(
        metaMensalData.meta_mensal,
        tipoOperacional,
        mes,
        ano,
        ajustes,
        dataHoje
      )
    : null;

  const metaHoje = metaHojeInfo?.metaCalculada ?? 0;

  return {
    metaHoje,
    metaHojeInfo,
    todasMetas,
    ajustes,
    metaMensal: metaMensalData?.meta_mensal ?? 0,
    metaMensalId: metaMensalData?.id ?? null,
    isLoading: isLoadingMeta || isLoadingAjustes,
    isError: isErrorMeta || isErrorAjustes,
  };
}
