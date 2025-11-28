import { Trophy } from "lucide-react";

type RankingHeaderProps = {
  totalLojas: number;
  dataAtual: string;
};

export function RankingHeader({ totalLojas, dataAtual }: RankingHeaderProps) {
  return (
    <div className="bg-card border rounded-xl p-6 md:p-10 text-center shadow-md">
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 mb-3 md:mb-4">
        <Trophy className="h-10 w-10 md:h-16 md:w-16 text-primary" />
        <h1 className="text-3xl md:text-5xl font-bold">Ranking de Performance</h1>
      </div>
      <p className="text-base md:text-2xl text-muted-foreground capitalize">
        {dataAtual} • {totalLojas} {totalLojas === 1 ? "Loja" : "Lojas"}
      </p>
    </div>
  );
}
