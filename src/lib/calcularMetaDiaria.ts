import { getDaysInMonth, getDay } from "date-fns";

/**
 * Calcula a meta diária baseada na meta mensal e tipo operacional da loja
 * 
 * @param metaMensal - Valor da meta mensal
 * @param tipoOperacional - 'A' (Domingo a Domingo) ou 'B' (Segunda a Sábado)
 * @param mes - Mês (1-12)
 * @param ano - Ano (ex: 2024)
 * @returns Meta diária arredondada para 2 casas decimais
 */
export function calcularMetaDiaria(
  metaMensal: number,
  tipoOperacional: "A" | "B",
  mes: number,
  ano: number
): number {
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

  // Calcula total de dias no mês
  const totalDiasDoMes = getDaysInMonth(new Date(ano, mes - 1));

  if (tipoOperacional === "A") {
    // Dom a Dom: Domingo a Domingo - todos os dias contam
    return Number((metaMensal / totalDiasDoMes).toFixed(2));
  } else {
    // Seg a Sáb: Segunda a Sábado - exclui domingos
    const quantidadeDeDomingos = contarDomingos(mes, ano);
    const diasUteis = totalDiasDoMes - quantidadeDeDomingos;
    
    if (diasUteis <= 0) {
      throw new Error("Número de dias úteis inválido");
    }
    
    return Number((metaMensal / diasUteis).toFixed(2));
  }
}

/**
 * Conta quantos domingos existem em um mês específico
 * 
 * @param mes - Mês (1-12)
 * @param ano - Ano (ex: 2024)
 * @returns Quantidade de domingos no mês
 */
function contarDomingos(mes: number, ano: number): number {
  const totalDias = getDaysInMonth(new Date(ano, mes - 1));
  let domingos = 0;

  for (let dia = 1; dia <= totalDias; dia++) {
    const date = new Date(ano, mes - 1, dia);
    // getDay() retorna 0 para domingo
    if (getDay(date) === 0) {
      domingos++;
    }
  }

  return domingos;
}
