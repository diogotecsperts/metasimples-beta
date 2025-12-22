import { getDaysInMonth, getDay, format } from "date-fns";

export type AjusteDiario = {
  id: string;
  meta_mensal_id: string;
  loja_id: string;
  data: string; // formato YYYY-MM-DD
  meta_original: number;
  meta_ajustada: number;
  motivo?: string;
};

export type MetaCalculadaPorDia = {
  data: string;
  metaCalculada: number;
  ajusteManual: boolean;
  motivo?: string;
};

/**
 * Calcula as metas diárias considerando ajustes manuais e redistribuição inteligente.
 * 
 * Regras:
 * 1. Dias com ajuste manual usam o valor ajustado
 * 2. A diferença entre meta original e ajustada é redistribuída proporcionalmente
 * 3. A redistribuição só acontece entre dias que NÃO têm ajuste manual
 * 4. Para tipo operacional B, domingos são automaticamente excluídos
 * 5. A soma total sempre deve ser igual à meta mensal
 */
export function calcularMetasDiariasComAjustes(
  metaMensal: number,
  tipoOperacional: "A" | "B",
  mes: number,
  ano: number,
  ajustes: AjusteDiario[]
): MetaCalculadaPorDia[] {
  // Valida os parâmetros
  if (metaMensal < 0) {
    throw new Error("Meta mensal não pode ser negativa");
  }

  if (mes < 1 || mes > 12) {
    throw new Error("Mês deve estar entre 1 e 12");
  }

  if (tipoOperacional !== "A" && tipoOperacional !== "B") {
    throw new Error("Tipo operacional deve ser 'A' ou 'B'");
  }

  const totalDiasDoMes = getDaysInMonth(new Date(ano, mes - 1));
  const resultado: MetaCalculadaPorDia[] = [];

  // Gerar array de todos os dias do mês
  const diasDoMes: { data: string; diaSemana: number }[] = [];
  for (let dia = 1; dia <= totalDiasDoMes; dia++) {
    const date = new Date(ano, mes - 1, dia);
    diasDoMes.push({
      data: format(date, "yyyy-MM-dd"),
      diaSemana: getDay(date), // 0 = domingo
    });
  }

  // Identificar dias operacionais (para tipo B, exclui domingos)
  const diasOperacionais = tipoOperacional === "B"
    ? diasDoMes.filter(d => d.diaSemana !== 0)
    : diasDoMes;

  // Calcular meta diária base
  const metaDiariaBase = diasOperacionais.length > 0
    ? metaMensal / diasOperacionais.length
    : 0;

  // Criar mapa de ajustes por data
  const ajustesPorData = new Map<string, AjusteDiario>();
  ajustes.forEach(a => ajustesPorData.set(a.data, a));

  // Calcular total de diferença a redistribuir
  let totalDiferencaRedistribuir = 0;
  ajustes.forEach(ajuste => {
    totalDiferencaRedistribuir += (ajuste.meta_original - ajuste.meta_ajustada);
  });

  // Contar dias elegíveis para redistribuição (dias operacionais sem ajuste)
  const diasElegiveisRedistribuicao = diasOperacionais.filter(
    d => !ajustesPorData.has(d.data)
  );

  // Calcular acréscimo por dia elegível
  const acrescimoporDia = diasElegiveisRedistribuicao.length > 0
    ? totalDiferencaRedistribuir / diasElegiveisRedistribuicao.length
    : 0;

  // Gerar resultado para cada dia do mês
  diasDoMes.forEach(({ data, diaSemana }) => {
    const ajuste = ajustesPorData.get(data);
    const isDomingoTipoB = tipoOperacional === "B" && diaSemana === 0;

    if (ajuste) {
      // Dia tem ajuste manual
      resultado.push({
        data,
        metaCalculada: Number(ajuste.meta_ajustada.toFixed(2)),
        ajusteManual: true,
        motivo: ajuste.motivo,
      });
    } else if (isDomingoTipoB) {
      // Domingo em loja tipo B - meta zero
      resultado.push({
        data,
        metaCalculada: 0,
        ajusteManual: false,
      });
    } else {
      // Dia normal com redistribuição
      const metaFinal = metaDiariaBase + acrescimoporDia;
      resultado.push({
        data,
        metaCalculada: Number(metaFinal.toFixed(2)),
        ajusteManual: false,
      });
    }
  });

  return resultado;
}

/**
 * Obtém a meta diária para uma data específica, considerando ajustes.
 */
export function getMetaDiariaPorData(
  metaMensal: number,
  tipoOperacional: "A" | "B",
  mes: number,
  ano: number,
  ajustes: AjusteDiario[],
  dataAlvo: string
): MetaCalculadaPorDia | null {
  const todasMetas = calcularMetasDiariasComAjustes(
    metaMensal,
    tipoOperacional,
    mes,
    ano,
    ajustes
  );

  return todasMetas.find(m => m.data === dataAlvo) || null;
}

/**
 * Verifica se um dia é domingo.
 */
export function isDomingo(data: string): boolean {
  const date = new Date(data + "T12:00:00");
  return getDay(date) === 0;
}

/**
 * Lista todos os domingos de um mês.
 */
export function listarDomingosDoMes(mes: number, ano: number): string[] {
  const totalDias = getDaysInMonth(new Date(ano, mes - 1));
  const domingos: string[] = [];

  for (let dia = 1; dia <= totalDias; dia++) {
    const date = new Date(ano, mes - 1, dia);
    if (getDay(date) === 0) {
      domingos.push(format(date, "yyyy-MM-dd"));
    }
  }

  return domingos;
}

/**
 * Calcula a prévia de redistribuição ao ajustar um dia.
 */
export function calcularPreviaRedistribuicao(
  metaMensal: number,
  tipoOperacional: "A" | "B",
  mes: number,
  ano: number,
  ajustesExistentes: AjusteDiario[],
  novoAjuste: { data: string; metaAjustada: number; metaOriginal: number }
): {
  diferenca: number;
  diasElegíveis: number;
  acrescimoporDia: number;
} {
  // Simular o novo ajuste
  const ajustesSimulados = [
    ...ajustesExistentes.filter(a => a.data !== novoAjuste.data),
    {
      id: "temp",
      meta_mensal_id: "temp",
      loja_id: "temp",
      data: novoAjuste.data,
      meta_original: novoAjuste.metaOriginal,
      meta_ajustada: novoAjuste.metaAjustada,
    },
  ];

  const totalDiasDoMes = getDaysInMonth(new Date(ano, mes - 1));
  const diasDoMes: { data: string; diaSemana: number }[] = [];

  for (let dia = 1; dia <= totalDiasDoMes; dia++) {
    const date = new Date(ano, mes - 1, dia);
    diasDoMes.push({
      data: format(date, "yyyy-MM-dd"),
      diaSemana: getDay(date),
    });
  }

  const diasOperacionais = tipoOperacional === "B"
    ? diasDoMes.filter(d => d.diaSemana !== 0)
    : diasDoMes;

  const ajustesPorData = new Map<string, AjusteDiario>();
  ajustesSimulados.forEach(a => ajustesPorData.set(a.data, a as AjusteDiario));

  let totalDiferencaRedistribuir = 0;
  ajustesSimulados.forEach(ajuste => {
    totalDiferencaRedistribuir += (ajuste.meta_original - ajuste.meta_ajustada);
  });

  const diasElegíveis = diasOperacionais.filter(
    d => !ajustesPorData.has(d.data)
  ).length;

  const acrescimoporDia = diasElegíveis > 0
    ? totalDiferencaRedistribuir / diasElegíveis
    : 0;

  return {
    diferenca: novoAjuste.metaOriginal - novoAjuste.metaAjustada,
    diasElegíveis,
    acrescimoporDia: Number(acrescimoporDia.toFixed(2)),
  };
}
