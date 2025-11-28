import { Trophy } from "lucide-react";

type RankingHeaderProps = {
  totalLojas: number;
  dataAtual: string;
};

export function RankingHeader({ totalLojas, dataAtual }: RankingHeaderProps) {
  return (
    <div className="bg-card border rounded-lg p-4 md:p-8 text-center">
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-2 md:mb-4">
        <Trophy className="h-8 w-8 md:h-12 md:w-12 text-primary" />
        <h1 className="text-2xl md:text-4xl font-bold">Ranking de Performance</h1>
      </div>
      <p className="text-sm md:text-xl text-muted-foreground">
        {dataAtual} • {totalLojas} {totalLojas === 1 ? "Loja" : "Lojas"}
      </p>
    </div>
  );
}
