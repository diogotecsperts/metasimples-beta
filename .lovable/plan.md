
# Ajuste: Faltante Diário/Mensal no card compacto (Admin Compacto, mensal)

## Problema atual

Hoje as linhas de Faltante Diário e Faltante Mensal usam um único flex row com `justify-between`. Quando o valor é curto, ele fica colado ao rótulo; quando o nome do outro lado é maior, o valor "quebra" para baixo só em alguns casos. Resultado: inconsistente entre cards. Além disso o "Faltante Mensal" não fica alinhado verticalmente com "Vendido".

## Padrão novo (uniforme, sempre igual)

Linha de Meta/Vendido continua exatamente como está hoje (rótulo + valor na mesma linha, lado a lado).

Linha de Faltantes vira um **grid de 2 colunas iguais**, espelhando a coluna esquerda (Meta) e a coluna direita (Vendido). Em cada coluna:

- Linha 1: rótulo ("Faltante Diário:" / "Faltante Mensal:")
- Linha 2: valor em negrito, **logo abaixo** do rótulo

Isso é aplicado **sempre**, independente do tamanho do valor. Nada de inline, nada de quebra condicional.

A coluna da direita começa exatamente no mesmo eixo X que "Vendido:" da linha acima (mesmo grid de 2 colunas iguais → o "F" de "Faltante Mensal" fica alinhado com o "V" de "Vendido").

## Layout exemplo

```text
┌──────────────────────────────────────────────┐
│  #3                            82.4%   ●     │
│              Loja Centro                     │
│ ──────────────────────────────────────────── │
│ Meta: R$ 150.000          Vendido: R$ 123.600│
│ Faltante Diário:          Faltante Mensal:   │
│ R$ 880                    R$ 26.400          │
└──────────────────────────────────────────────┘
```

Quando o faltante for 0 (loja bateu), o valor abaixo aparece em verde (mantém regra atual).

## Arquivo a alterar

Apenas **`src/components/dashboard/RankingCardCompact.tsx`**.

Trocar o bloco atual:

```tsx
<div className="flex items-center justify-between text-[10px] text-gray-600">
  <span>Faltante Diário: <span>...</span></span>
  <span>Faltante Mensal: <span>...</span></span>
</div>
```

Por um grid de 2 colunas, cada célula com `flex-col`:

```tsx
<div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
  <div className="flex flex-col leading-tight">
    <span>Faltante Diário:</span>
    <span className={cn("font-semibold", faltanteDiario === 0 && "text-green-600")}>
      {formatCurrencyCompact(faltanteDiario)}
    </span>
  </div>
  <div className="flex flex-col leading-tight">
    <span>Faltante Mensal:</span>
    <span className={cn("font-semibold", faltanteMensal === 0 && "text-green-600")}>
      {formatCurrencyCompact(faltanteMensal)}
    </span>
  </div>
</div>
```

`grid-cols-2` garante que as duas colunas tenham a mesma largura, espelhando o flex `justify-between` da linha Meta/Vendido acima → alinhamento vertical perfeito do "F" com o "V".

## Garantias

- Só toca o modo mensal do card compacto (bloco já guardado por `showFaltantes`).
- Não altera Desktop, Gerente Compacto, export diário, nem cálculo de dados.
- Tipografia/cor idênticas (`text-[10px] text-gray-600`, verde quando 0).
- Sem mudança em banco, queries ou edge functions.

## Validação

- Exportar Admin Compacto mensal → conferir que em todos os cards o valor fica embaixo do rótulo e "Faltante Mensal" alinha com "Vendido".
- Conferir card com faltante longo (ex.: R$ 999.999) e curto (R$ 0) → layout idêntico.
- Conferir export diário e Gerente Compacto inalterados.
