import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Users, UserCog, UserCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChangelogItem = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "disponivel" | "desenvolvimento" | "indeterminado";
};

type User = {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "gerente";
};

type Props = {
  item: ChangelogItem;
  onClose: () => void;
};

const MASTER_USER_ID = "ca936b16-8a15-43f4-976d-6be91e294099";

const categoriaConfig: Record<string, { label: string; emoji: string; color: string }> = {
  disponivel: { label: "Disponível", emoji: "✅", color: "#10b981" },
  desenvolvimento: { label: "Em Desenvolvimento", emoji: "🔄", color: "#f59e0b" },
  indeterminado: { label: "Indeterminado", emoji: "❓", color: "#6b7280" },
};

export function ChangelogEmailDialog({ item, onClose }: Props) {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Buscar lista de usuários (admins + gerentes)
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-for-email"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-users-for-email");
      if (error) throw error;
      return (data?.users || []) as User[];
    },
  });

  // Separar e ordenar: admins primeiro (alfabético), depois gerentes (alfabético)
  const admins = users?.filter((u) => u.role === "admin").sort((a, b) => a.nome.localeCompare(b.nome)) || [];
  const gerentes = users?.filter((u) => u.role === "gerente").sort((a, b) => a.nome.localeCompare(b.nome)) || [];
  const sortedUsers = [...admins, ...gerentes];

  // Enviar email
  const sendMutation = useMutation({
    mutationFn: async () => {
      const selectedEmails = users?.filter((u) => selectedUsers.includes(u.id)).map((u) => u.email) || [];

      const { data, error } = await supabase.functions.invoke("send-changelog-email", {
        body: {
          emails: selectedEmails,
          item: {
            titulo: item.titulo,
            descricao: item.descricao,
            categoria: item.categoria,
          },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Email enviado com sucesso",
        description: `Enviado para ${selectedUsers.length} destinatário(s)`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedUsers(users?.map((u) => u.id) || []);
  };

  const selectAdmins = () => {
    setSelectedUsers(admins.map((u) => u.id));
  };

  const selectGerentes = () => {
    setSelectedUsers(gerentes.map((u) => u.id));
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  const allSelected = users && selectedUsers.length === users.length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar Novidade por Email</DialogTitle>
          <DialogDescription>
            Selecione os destinatários que receberão esta atualização
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 py-4 pr-4">
            {/* Preview visual do email */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mail className="h-4 w-4" />
                Prévia do Email
              </div>
              <div className="rounded-xl border bg-[#f4f4f5] p-4">
                <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold" style={{ color: "#1e3a5f" }}>
                      ✨ Novidade no Meta simples
                    </h3>
                    <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                      Uma nova atualização foi publicada no sistema
                    </p>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    {/* Badge categoria */}
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        backgroundColor: `${categoriaConfig[item.categoria]?.color}15`,
                        color: categoriaConfig[item.categoria]?.color,
                        border: `1px solid ${categoriaConfig[item.categoria]?.color}30`,
                      }}
                    >
                      {categoriaConfig[item.categoria]?.emoji} {categoriaConfig[item.categoria]?.label}
                    </span>
                    
                    {/* Título */}
                    <h4 className="text-lg font-semibold mt-4" style={{ color: "#1f2937" }}>
                      {item.titulo}
                    </h4>
                    
                    {/* Descrição */}
                    <p className="mt-3 text-base leading-relaxed text-justify" style={{ color: "#4b5563" }}>
                      {item.descricao.trim()}
                    </p>
                  </div>
                  
                  {/* Footer */}
                  <div className="px-6 py-4 bg-[#f9fafb] border-t border-gray-200">
                    <p className="text-xs text-center" style={{ color: "#9ca3af" }}>
                      Enviado pelo Meta Simples • Sistema de Gestão de Metas
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de usuários */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Destinatários</Label>
              {users && users.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {admins.length} admin(s) • {gerentes.length} gerente(s)
                </span>
              )}
            </div>

            {/* Botões de seleção rápida */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={allSelected ? clearSelection : selectAll}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                {allSelected ? "Limpar" : "Todos"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAdmins}
                className="gap-1.5"
                disabled={admins.length === 0}
              >
                <UserCog className="h-3.5 w-3.5" />
                Admins ({admins.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectGerentes}
                className="gap-1.5"
                disabled={gerentes.length === 0}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Gerentes ({gerentes.length})
              </Button>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sortedUsers.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-2">
                {sortedUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      {user.id === MASTER_USER_ID ? (
                        <Badge className="shrink-0 text-xs bg-purple-600 hover:bg-purple-700">
                          Master
                        </Badge>
                      ) : user.role === "admin" ? (
                        <Badge variant="default" className="shrink-0 text-xs">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Gerente
                        </Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum usuário encontrado
              </p>
            )}
          </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={selectedUsers.length === 0 || sendMutation.isPending}
            className="gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar ({selectedUsers.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
