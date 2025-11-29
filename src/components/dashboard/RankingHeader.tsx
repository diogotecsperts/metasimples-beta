import { Trophy } from "lucide-react";
import logo from "@/assets/logo.png";

type RankingHeaderProps = {
  totalLojas: number;
  dataAtual: string;
};

export function RankingHeader({ totalLojas, dataAtual }: RankingHeaderProps) {
  return (
    <div className="bg-card border rounded-xl p-4 md:p-6 text-center shadow-md">
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-2">
        <img src={logo} alt="Meta Simples" className="h-8 w-auto" />
        <Trophy className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">Ranking de Performance</h1>
      </div>
      <p className="text-sm md:text-base text-muted-foreground capitalize">
        {dataAtual} • {totalLojas} {totalLojas === 1 ? "Loja" : "Lojas"}
      </p>
    </div>
  );
}
