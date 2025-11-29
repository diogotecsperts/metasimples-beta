export const TIPO_OPERACIONAL_LABELS = {
  A: "Dom a Dom",
  B: "Seg a Sáb"
} as const;

export const TIPO_OPERACIONAL_DESCRIPTIONS = {
  A: "Domingo a Domingo",
  B: "Segunda a Sábado"
} as const;

export function getTipoOperacionalLabel(tipo: "A" | "B"): string {
  return TIPO_OPERACIONAL_LABELS[tipo];
}

export function getTipoOperacionalDescription(tipo: "A" | "B"): string {
  return TIPO_OPERACIONAL_DESCRIPTIONS[tipo];
}
