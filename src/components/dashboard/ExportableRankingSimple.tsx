import { forwardRef } from "react";
import { RankingCardSimple } from "./RankingCardSimple";

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  percentualAtingimento: number;
};

type ExportableRankingSimpleProps = {
  ranking: RankingItem[];
  dataFormatada: string;
  isMensal?: boolean;
};

export const ExportableRankingSimple = forwardRef<HTMLDivElement, ExportableRankingSimpleProps>(
  ({ ranking, dataFormatada, isMensal = false }, ref) => {
    const lojasComMeta = ranking.filter((r) => r.metaDiaria > 0);

    return (
      <div
        ref={ref}
        className="bg-white p-6 w-[520px]"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {/* Header */}
        <div className="text-center mb-4 pb-4 border-b-2 border-gray-200">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">
              Ranking de Performance{isMensal ? " Mensal" : ""}
            </h2>
            {isMensal && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded">
                MENSAL
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{dataFormatada}</p>
          <p className="text-xs text-gray-500 mt-0.5">{lojasComMeta.length} lojas</p>
        </div>

        {/* Grid de Cards */}
        <div className="grid grid-cols-2 gap-2">
          {lojasComMeta.map((item, index) => (
            <RankingCardSimple
              key={item.lojaId}
              posicao={index + 1}
              nomeLoja={item.nomeLoja}
              percentualAtingimento={item.percentualAtingimento}
              temMeta={item.metaDiaria > 0}
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

ExportableRankingSimple.displayName = "ExportableRankingSimple";
