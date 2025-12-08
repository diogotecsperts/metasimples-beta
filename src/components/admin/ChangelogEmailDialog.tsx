import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Users, UserCog, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  const admins = users?.filter((u) => u.role === "admin") || [];
  const gerentes = users?.filter((u) => u.role === "gerente") || [];

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Novidade por Email</DialogTitle>
          <DialogDescription>
            Selecione os destinatários que receberão esta atualização
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview do item */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-sm font-medium">{item.titulo}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {item.descricao}
            </p>
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
            ) : users && users.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-2">
                {users.map((user) => (
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
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {user.role === "admin" ? "Admin" : "Gerente"}
                      </Badge>
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
