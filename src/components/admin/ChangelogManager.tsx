import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChangelogList } from "./ChangelogList";
import { ChangelogMasterPanel } from "./ChangelogMasterPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MASTER_USER_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

export function ChangelogManager() {
  const { user, isLoading } = useAuth();
  const [abaChangelog, setAbaChangelog] = useState("novidades");

  // Função helper para classes dinâmicas das abas com animação
  const getChangelogTabClass = (tabValue: string) => {
    const isActive = abaChangelog === tabValue;
    return cn(
      "gap-2 tab-animated",
      isActive 
        ? "bg-white text-foreground shadow-md border border-border dark:bg-zinc-800 scale-[1.01]" 
        : "hover:bg-muted/50"
    );
  };

  // Aguardar carregamento do usuário
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  const isMaster = user?.id === MASTER_USER_ID;

  if (!isMaster) {
    // Admins normais só veem a lista de novidades
    return <ChangelogList />;
  }

  // Master vê tabs: Novidades (visualização) e Gerenciar (painel)
  return (
    <Tabs value={abaChangelog} onValueChange={setAbaChangelog} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="novidades" className={getChangelogTabClass("novidades")}>
          <Sparkles className="h-4 w-4" />
          Visualização
        </TabsTrigger>
        <TabsTrigger value="gerenciar" className={getChangelogTabClass("gerenciar")}>
          <Settings className="h-4 w-4" />
          Gerenciar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="novidades">
        <ChangelogList />
      </TabsContent>

      <TabsContent value="gerenciar">
        <ChangelogMasterPanel />
      </TabsContent>
    </Tabs>
  );
}
