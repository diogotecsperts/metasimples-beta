import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

type Admin = {
  id: string;
  nome: string;
  email: string;
};

type Props = {
  item: ChangelogItem;
  onClose: () => void;
};

export function ChangelogEmailDialog({ item, onClose }: Props) {
  const { toast } = useToast();
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

  // Buscar lista de admins
  const { data: admins, isLoading: loadingAdmins } = useQuery({
    queryKey: ["admins-for-email"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-admins");
      if (error) throw error;
      return data as Admin[];
    },
  });

  // Enviar email
  const sendMutation = useMutation({
    mutationFn: async () => {
      const selectedEmails = admins?.filter(a => selectedAdmins.includes(a.id)).map(a => a.email) || [];
      
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
        description: `Enviado para ${selectedAdmins.length} admin(s)` 
      });
      onClose();
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao enviar email", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const toggleAdmin = (id: string) => {
    setSelectedAdmins(prev => 
      prev.includes(id) 
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (admins && selectedAdmins.length === admins.length) {
      setSelectedAdmins([]);
    } else {
      setSelectedAdmins(admins?.map(a => a.id) || []);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Novidade por Email</DialogTitle>
          <DialogDescription>
            Selecione os administradores que receberão esta atualização
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

          {/* Lista de admins */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Destinatários</Label>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {admins && selectedAdmins.length === admins.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            
            {loadingAdmins ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : admins && admins.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-lg border p-2">
                {admins.map((admin) => (
                  <label
                    key={admin.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedAdmins.includes(admin.id)}
                      onCheckedChange={() => toggleAdmin(admin.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{admin.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum admin encontrado
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
            disabled={selectedAdmins.length === 0 || sendMutation.isPending}
            className="gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar ({selectedAdmins.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
