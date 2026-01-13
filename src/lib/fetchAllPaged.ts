import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth } from "date-fns";

const PAGE_SIZE = 1000;

type LancamentoDiario = {
  id: string;
  loja_id: string;
  data: string;
  valor_acumulado: number;
};

type MetaData = {
  loja_id: string;
  meta_diaria_calculada: number;
};

/**
 * Fetches all lancamentos_diarios for a given date range.
 * Handles pagination automatically to bypass the 1000 row limit.
 * Optimized: uses data+loja_id ordering for better index usage.
 */
export async function fetchLancamentosMensais(
  primeiroDia: string,
  ultimoDia: string
): Promise<LancamentoDiario[]> {
  const allData: LancamentoDiario[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("lancamentos_diarios")
      .select("id, loja_id, data, valor_acumulado")
      .gte("data", primeiroDia)
      .lte("data", ultimoDia)
      .order("data", { ascending: true })
      .order("loja_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (import.meta.env.DEV) {
    console.log(`📊 fetchLancamentosMensais: Loaded ${allData.length} rows for ${primeiroDia} to ${ultimoDia}`);
  }

  return allData;
}

/**
 * Fetches complete period data (metas + lancamentos) in PARALLEL.
 * This is significantly faster than sequential fetching.
 */
export async function fetchPeriodoCompleto(
  mes: number,
  ano: number
): Promise<{ metas: MetaData[]; lancamentos: LancamentoDiario[] }> {
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = format(endOfMonth(new Date(ano, mes - 1)), "yyyy-MM-dd");

  // Execute metas and lancamentos in PARALLEL
  const [metasResult, lancamentos] = await Promise.all([
    supabase
      .from("metas_mensais")
      .select("loja_id, meta_diaria_calculada")
      .eq("mes", mes)
      .eq("ano", ano),
    fetchLancamentosMensais(inicioMes, fimMes),
  ]);

  if (metasResult.error) {
    throw metasResult.error;
  }

  if (import.meta.env.DEV) {
    console.log(`📊 fetchPeriodoCompleto: ${mes}/${ano} - ${metasResult.data?.length || 0} metas, ${lancamentos.length} lancamentos (parallel)`);
  }

  return {
    metas: metasResult.data || [],
    lancamentos,
  };
}
