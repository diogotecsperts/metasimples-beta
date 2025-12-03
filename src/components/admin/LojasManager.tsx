import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LojaForm, type LojaFormValues } from "./LojaForm";
import { LojasList, type Loja } from "./LojasList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { registrarAuditLog } from "@/lib/auditLog";

export function LojasManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLoja, setEditingLoja] = useState<Loja | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch lojas
  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loja[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: LojaFormValues) => {
      const { data, error } = await supabase.from("lojas").insert([{
        nome: values.nome,
        tipo_operacional: values.tipo_operacional,
        possui_fechamento_tardio: values.possui_fechamento_tardio,
      }]).select().single();
      if (error) throw error;
      return { lojaId: data.id, nome: values.nome };
    },
    onSuccess: async ({ lojaId, nome }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "create",
        entity: "loja",
        entityId: lojaId,
        entityName: nome,
      });

      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      setIsDialogOpen(false);
      toast({
        title: "Loja criada",
        description: "A loja foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar loja",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
      oldValues,
    }: {
      id: string;
      values: LojaFormValues;
      oldValues?: Loja;
    }) => {
      const { error } = await supabase
        .from("lojas")
        .update({
          nome: values.nome,
          tipo_operacional: values.tipo_operacional,
          possui_fechamento_tardio: values.possui_fechamento_tardio,
        })
        .eq("id", id);
      if (error) throw error;
      return { id, nome: values.nome, oldValues };
    },
    onSuccess: async ({ id, nome, oldValues }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "update",
        entity: "loja",
        entityId: id,
        entityName: nome,
        details: oldValues ? { antes: JSON.parse(JSON.stringify(oldValues)) } : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      setIsDialogOpen(false);
      setEditingLoja(null);
      toast({
        title: "Loja atualizada",
        description: "A loja foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar loja",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("lojas").delete().eq("id", id);
      if (error) throw error;
      return { id, nome };
    },
    onSuccess: async ({ id, nome }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "delete",
        entity: "loja",
        entityId: id,
        entityName: nome,
      });

      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      toast({
        title: "Loja excluída",
        description: "A loja foi excluída com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir loja",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (values: LojaFormValues) => {
    if (editingLoja) {
      await updateMutation.mutateAsync({ id: editingLoja.id, values, oldValues: editingLoja });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleEdit = (loja: Loja) => {
    setEditingLoja(loja);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const loja = lojas.find((l) => l.id === id);
    await deleteMutation.mutateAsync({ id, nome: loja?.nome || "" });
  };

  const handleOpenDialog = () => {
    setEditingLoja(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLoja(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Lojas</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre e gerencie as lojas do sistema
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Loja
        </Button>
      </div>

      <LojasList
        lojas={lojas}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLoja ? "Editar Loja" : "Nova Loja"}
            </DialogTitle>
          </DialogHeader>
          <LojaForm
            defaultValues={editingLoja || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
