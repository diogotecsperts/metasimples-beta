
# Plano Final: Faltante Diário e Faltante Mensal — apenas nos exports do Ranking MENSAL

## Escopo (revisado)

Adicionar duas novas linhas dentro de cada card de loja **somente** nos exports gerados a partir do **Ranking Mensal**:

- **Faltante Diário** → logo abaixo da linha "Meta Mensal" / "Meta"
- **Faltante Mensal** → logo abaixo da linha "Total do Mês" / "Vendido"

Afeta os formatos:
- ✅ **Desktop** (mensal)
- ✅ **Admin Compacto** (mensal)
- ❌ **Gerente Compacto** (continua minimalista — sem alteração)
- ❌ **Todos os exports do Ranking Diário** (intactos)

## Layout exemplo — Admin Compacto (Mensal)

```text
┌────────────────────────────────────────────┐
│  #3                          82.4%   ●     │
│              Loja Centro                   │
│ ────────────────────────────────────────── │
│ Meta: R$ 150.000        Vendido: R$ 123.600│
│ Faltante Diário: R$ 880 Faltante Mensal:   │
│                              R$ 26.400     │
└────────────────────────────────────────────┘
```

## Layout exemplo — Desktop (Mensal)

```text
┌─────────────────────────────────────────────┐
│  #3              Loja Centro                │
│                                             │
│  Meta Mensal:                  R$ 150.000   │
│  Faltante Diário:              R$ 880       │
│  Total do Mês:                 R$ 123.600   │
│  Faltante Mensal:              R$ 26.400    │
│  ─────────────────────────────────────────  │
│  Atingimento:                      82.4%    │
└─────────────────────────────────────────────┘
```

Tipografia/cor herdada exatamente das linhas vizinhas:
- Admin Compacto: `text-[10px] text-gray-600` (mesmo da linha Meta/Vendido)
- Desktop: label `fontSize: 14, color: #6b7280` / valor `fontSize: 18, fontWeight: 600, color: #1f2937`

Quando o faltante for `≤ 0` (loja já bateu a meta), o valor aparece em verde (`#22c55e`) como `R$ 0` — sem alterar layout.

## Origem dos dados (parte técnica)

**Cálculo 100% no frontend. Zero alteração em banco, edge functions ou queries.**

Hoje em `src/pages/Dashboard.tsx`:

- O `useMemo` do `ranking` (diário) já tem `metaDiaria` e `totalVendido` por loja.
- O `useMemo` do `rankingMensal` já tem `metaMensal` e `totalVendidoMes` por loja.

O que vou fazer:

1. **Enriquecer o `rankingMensal`** com os dois campos diários, fazendo lookup por `lojaId` no `ranking` diário já existente — apenas combinação em memória.

2. No componente do card (ambos os exports), calcular:
   - `faltanteDiario = max(0, metaDiaria - totalVendido)`
   - `faltanteMensal = max(0, metaMensal - totalVendidoMes)`

Sem nova chamada de rede, sem nova RLS, sem nova migration.

## Arquivos a modificar (4 arquivos, frontend puro)

1. **`src/pages/Dashboard.tsx`**
   - No `useMemo` do `rankingMensal`, adicionar lookup no `ranking` diário e anexar `metaDiaria` + `totalVendidoDiario` por loja.
   - Atualizar o objeto passado ao `ExportRankingButton` no fluxo mensal (linhas ~749, onde `ranking` é montado para o botão a partir do `rankingMensal`).

2. **`src/components/dashboard/ExportRankingButton.tsx`**
   - Estender o type `RankingItem` local com `metaMensal?: number`, `totalVendidoMes?: number`, `metaDiaria` e `totalVendido` já existem.
   - Repassar tudo sem alteração para os dois componentes export afetados.

3. **`src/components/dashboard/ExportableRanking.tsx`** + **`src/components/dashboard/RankingCardCompact.tsx`** (Admin Compacto)
   - `ExportableRanking` repassa os campos novos ao card **apenas quando `isMensal=true`**.
   - `RankingCardCompact` recebe props opcionais `faltanteDiario` e `faltanteMensal` e renderiza uma 2ª linha abaixo da atual com a mesma estética. Se não vierem (modo diário), nada muda.

4. **`src/components/dashboard/ExportableRankingDesktop.tsx`**
   - Em `RankingCardDesktop`, inserir as duas novas linhas (Faltante Diário após Meta; Faltante Mensal após Total do Mês) **somente quando `isMensal=true`**.

## Garantias de segurança

| Risco | Mitigação |
|---|---|
| Quebrar export diário | Toda a renderização nova é guarded por `isMensal` |
| Quebrar Gerente Compacto | Não toco em `ExportableRankingSimple`/`RankingCardSimple` |
| Quebrar cálculo de ranking/metas | Não altero a lógica de `metaDiaria`/`metaMensal`/`totalVendido` — apenas leio |
| Quebrar tipos do projeto | Campos novos são opcionais (`?:`), retrocompatíveis |
| Performance | Lookup `O(n)` em memória sobre arrays já carregados |
| Banco / RLS / Edge functions | Nenhuma mudança |

## Validação após implementar

- Exportar Desktop e Admin Compacto **no modo mensal** → conferir que as duas novas linhas aparecem corretas.
- Exportar Desktop e Admin Compacto **no modo diário** → conferir que ficou idêntico ao atual (sem as linhas novas).
- Exportar Gerente Compacto (mensal e diário) → conferir que está inalterado.
- Conferir aritmética: `Meta − Vendido = Faltante` em pelo menos 2 lojas.
