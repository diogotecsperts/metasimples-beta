import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Loader2, Clock, HelpCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ChangelogItem = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "disponivel" | "desenvolvimento" | "indeterminado";
  published_at: string;
  created_at: string;
};

const categoriaConfig = {
  disponivel: {
    label: "Disponível",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    dotColor: "bg-emerald-500",
  },
  desenvolvimento: {
    label: "Em desenvolvimento",
    icon: Loader2,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dotColor: "bg-amber-500",
  },
  indeterminado: {
    label: "Indeterminado",
    icon: HelpCircle,
    color: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    dotColor: "bg-slate-400",
  },
};

export function ChangelogList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar itens do changelog publicados
  const { data: items, isLoading } = useQuery({
    queryKey: ["changelog-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog_items")
        .select("*")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data as ChangelogItem[];
    },
  });

  // Atualizar status de leitura quando abrir a página
  const updateReadStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      
      const { error } = await supabase
        .from("changelog_read_status")
        .upsert({
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-unread-count"] });
    },
  });

  // Marcar como lido ao montar o componente
  useEffect(() => {
    if (user?.id) {
      updateReadStatus.mutate();
    }
  }, [user?.id]);

  // Agrupar por categoria
  const groupedItems = items?.reduce((acc, item) => {
    if (!acc[item.categoria]) {
      acc[item.categoria] = [];
    }
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, ChangelogItem[]>) || {};

  const categoryOrder: Array<"disponivel" | "desenvolvimento" | "indeterminado"> = [
    "disponivel",
    "desenvolvimento",
    "indeterminado",
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium">Nenhuma novidade ainda</h3>
          <p className="text-sm text-muted-foreground">
            As atualizações do sistema aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Novidades do Sistema
        </h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe as atualizações e novos recursos
        </p>
      </div>

      {/* Timeline por categoria */}
      <div className="space-y-8">
        {categoryOrder.map((categoria) => {
          const categoryItems = groupedItems[categoria];
          if (!categoryItems || categoryItems.length === 0) return null;

          const config = categoriaConfig[categoria];
          const Icon = config.icon;

          return (
            <div key={categoria} className="space-y-4">
              {/* Categoria Header */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className={`h-5 w-5 ${categoria === "desenvolvimento" ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <h3 className="font-semibold">{config.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {categoryItems.length} {categoryItems.length === 1 ? "item" : "itens"}
                  </p>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 border-l-2 border-border space-y-4">
                {categoryItems.map((item) => (
                  <div key={item.id} className="relative">
                    {/* Dot */}
                    <div className={`absolute -left-[25px] w-3 h-3 rounded-full ${config.dotColor} ring-4 ring-background`} />
                    
                    {/* Card */}
                    <div className="bg-card rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <h4 className="font-medium leading-tight">{item.titulo}</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {item.descricao}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {format(new Date(item.published_at), "dd MMM", { locale: ptBR })}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
