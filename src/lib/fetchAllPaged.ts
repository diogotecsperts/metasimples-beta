import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

type LancamentoDiario = {
  id: string;
  loja_id: string;
  data: string;
  valor_acumulado: number;
};

/**
 * Fetches all lancamentos_diarios for a given date range.
 * Handles pagination automatically to bypass the 1000 row limit.
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
      .order("id", { ascending: true })
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
