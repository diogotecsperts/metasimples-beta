import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type RealtimeIndicatorProps = {
  isConnected: boolean;
};

export function RealtimeIndicator({ isConnected }: RealtimeIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors w-full justify-center md:w-auto",
        isConnected
          ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400"
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Atualização em tempo real</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Desconectado</span>
        </>
      )}
    </div>
  );
}
