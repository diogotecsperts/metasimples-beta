import { forwardRef } from "react";
import { RankingCardCompact } from "./RankingCardCompact";

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
};

type ExportableRankingProps = {
  ranking: RankingItem[];
  dataFormatada: string;
  metaTotal: number;
  vendasTotal: number;
  atingimentoGeral: number;
  isMensal?: boolean;
};

export const ExportableRanking = forwardRef<HTMLDivElement, ExportableRankingProps>(
  ({ ranking, dataFormatada, metaTotal, vendasTotal, atingimentoGeral, isMensal = false }, ref) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    const getStatusColor = () => {
      if (atingimentoGeral >= 100) return "text-green-600";
      if (atingimentoGeral >= 80) return "text-yellow-600";
      return "text-red-600";
    };

    const lojasComMeta = ranking.filter((r) => r.metaDiaria > 0);

    return (
      <div
        ref={ref}
        className="bg-white p-6 w-[520px]"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {/* Header */}
        <div className="text-center mb-4 pb-4 border-b-2 border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Ranking de Performance{isMensal && <span style={{color: "#3b82f6"}}> Mensal</span>}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{dataFormatada}</p>
          <p className="text-xs text-gray-500 mt-0.5">{ranking.length} lojas</p>
        </div>

        {/* Resumo Geral */}
        <div className="grid grid-cols-3 gap-3 mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">{isMensal ? "Meta Mensal" : "Meta"}</p>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(metaTotal)}</p>
          </div>
          <div className="text-center border-x border-gray-200">
            <p className="text-xs text-gray-500 mb-1">{isMensal ? "Total do Mês" : "Vendido"}</p>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(vendasTotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Atingimento</p>
            <p className={`text-sm font-bold ${getStatusColor()}`}>
              {atingimentoGeral.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Grid de Cards */}
        <div className="grid grid-cols-2 gap-2">
          {lojasComMeta.map((item, index) => (
            <RankingCardCompact
              key={item.lojaId}
              posicao={index + 1}
              nomeLoja={item.nomeLoja}
              percentualAtingimento={item.percentualAtingimento}
              temMeta={item.metaDiaria > 0}
              metaDiaria={item.metaDiaria}
              totalVendido={item.totalVendido}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-5 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">Gerado por Meta Simples</p>
        </div>
      </div>
    );
  }
);

ExportableRanking.displayName = "ExportableRanking";
