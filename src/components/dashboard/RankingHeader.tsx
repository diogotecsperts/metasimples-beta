import { Trophy } from "lucide-react";

type RankingHeaderProps = {
  totalLojas: number;
  dataAtual: string;
};

export function RankingHeader({ totalLojas, dataAtual }: RankingHeaderProps) {
  return (
    <div className="bg-card border rounded-lg p-8 text-center">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Trophy className="h-12 w-12 text-primary" />
        <h1 className="text-4xl font-bold">Ranking de Performance</h1>
      </div>
      <p className="text-xl text-muted-foreground">
        {dataAtual} • {totalLojas} {totalLojas === 1 ? "Loja" : "Lojas"}
      </p>
    </div>
  );
}
