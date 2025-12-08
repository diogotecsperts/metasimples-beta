import { Trophy, Wrench } from "lucide-react";
import logo from "@/assets/logo.png";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
type RankingHeaderProps = {
  totalLojas: number;
  dataAtual: string;
  userName?: string | null;
};
export function RankingHeader({
  totalLojas,
  dataAtual,
  userName
}: RankingHeaderProps) {
  return <div className="bg-card border rounded-xl p-4 md:p-6 text-center shadow-md">
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-2">
        
        <Trophy className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">Ranking de Performance</h1>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-help flex items-center gap-1 text-xs">
                <Wrench className="h-3 w-3" />
                Beta
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Em desenvolvimento. Algumas funcionalidades ainda estão sendo finalizadas.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-sm md:text-base text-muted-foreground capitalize">
        {userName && (
          <>
            <span className="font-medium text-foreground normal-case">Bem-vindo, {userName}</span>
            {" · "}
          </>
        )}
        {dataAtual} · {totalLojas} {totalLojas === 1 ? "Loja" : "Lojas"}
      </p>
    </div>;
}