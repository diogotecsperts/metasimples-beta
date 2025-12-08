import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useChangelogUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["changelog-unread-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Buscar última leitura do usuário
      const { data: readStatus } = await supabase
        .from("changelog_read_status")
        .select("last_read_at")
        .eq("user_id", user.id)
        .single();

      const lastReadAt = readStatus?.last_read_at || new Date(0).toISOString();

      // Contar itens publicados após última leitura
      const { count, error } = await supabase
        .from("changelog_items")
        .select("*", { count: "exact", head: true })
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .gt("published_at", lastReadAt);

      if (error) {
        console.error("Erro ao buscar contagem de novidades:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Atualizar a cada 1 minuto
    staleTime: 30000,
  });
}
