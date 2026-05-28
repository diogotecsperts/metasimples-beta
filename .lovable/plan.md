
# Correção do alinhamento "Vendido" ↔ "Faltante Mensal"

## Causa do problema

Hoje a linha de Meta/Vendido usa `flex justify-between`:

```tsx
<div className="flex items-center justify-between ...">
  <span>Meta: <b>R$ X</b></span>
  <span>Vendido: <b>R$ Y</b></span>
</div>
```

Com `justify-between`, a palavra "Vendido:" é empurrada para a direita até onde o valor terminar. Como o valor de "Vendido" varia de tamanho entre lojas (R$ 1.234 vs R$ 123.456), a posição X de "Vendido:" muda de card para card.

Já a linha de Faltantes usa `grid grid-cols-2`, então "Faltante Mensal:" começa **sempre exatamente em 50%** da largura do card. Resultado: desalinhamento visível.

Meta/Faltante Diário já alinham porque ambos começam na borda esquerda (x = 0).

## Solução

Trocar a linha de Meta/Vendido para usar **o mesmo `grid grid-cols-2 gap-2`** da linha de Faltantes. Assim "Vendido:" também passa a começar fixo em 50%, exatamente acima de "Faltante Mensal:".

### Arquivo único alterado

`src/components/dashboard/RankingCardCompact.tsx`

### Mudança

De:

```tsx
<div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-gray-200 pt-1 mt-0.5">
  <span>Meta: <span className="font-semibold">{formatCurrencyCompact(metaDiaria)}</span></span>
  <span>Vendido: <span className="font-semibold">{formatCurrencyCompact(totalVendido)}</span></span>
</div>
```

Para:

```tsx
<div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 border-t border-gray-200 pt-1 mt-0.5">
  <span>Meta: <span className="font-semibold">{formatCurrencyCompact(metaDiaria)}</span></span>
  <span>Vendido: <span className="font-semibold">{formatCurrencyCompact(totalVendido)}</span></span>
</div>
```

Mesmas classes de tipografia, cor, borda e espaçamento. Só muda `flex items-center justify-between` → `grid grid-cols-2 gap-2`, espelhando a linha de Faltantes logo abaixo.

## Resultado visual

```text
┌──────────────────────────────────────────────┐
│  #3                            82.4%   ●     │
│              Loja Centro                     │
│ ──────────────────────────────────────────── │
│ Meta: R$ 150.000      Vendido: R$ 123.600    │
│ Faltante Diário:      Faltante Mensal:       │
│ R$ 880                R$ 26.400              │
└──────────────────────────────────────────────┘
```

"Vendido:" e "Faltante Mensal:" agora começam exatamente no mesmo eixo X em todos os cards, independente do tamanho do valor.

## Garantias

- Apenas o card compacto (`RankingCardCompact.tsx`) é tocado.
- Não afeta Desktop, Gerente Compacto, export diário, cálculos, queries, edge functions ou banco.
- Tipografia, cores, bordas e espaçamento permanecem idênticos.
- Funciona tanto no modo diário (sem linha de Faltantes) quanto mensal — no diário o grid de Meta/Vendido continua funcionando exatamente igual ao flex anterior, só com posicionamento fixo em 50/50.

## Validação

- Exportar Admin Compacto mensal com lojas de valores curtos e longos → "Vendido" e "Faltante Mensal" alinhados em todos.
- Exportar Admin Compacto diário → linha Meta/Vendido continua legível e bem distribuída.
- Conferir Gerente Compacto e Desktop inalterados.
