import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GerenteForm, type GerenteFormValues, type Gerente } from "./GerenteForm";
import { GerentesList } from "./GerentesList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Loja = {
  id: string;
  nome: string;
};

export function GerentesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGerente, setEditingGerente] = useState<Gerente | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch gerentes (profiles)
  const { data: gerentes = [], isLoading: isLoadingGerentes } = useQuery({
    queryKey: ["gerentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "gerente")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Gerente[];
    },
  });

  // Fetch lojas
  const { data: lojas = [], isLoading: isLoadingLojas } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Loja[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: GerenteFormValues) => {
      if (!values.email || !values.senha) {
        throw new Error("Email e senha são obrigatórios");
      }

      // Call edge function to create gerente securely
      const { data, error } = await supabase.functions.invoke('create-gerente', {
        body: {
          email: values.email,
          password: values.senha,
          nome: values.nome,
          loja_id: values.loja_id,
          telefone: values.telefone,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerentes"] });
      setIsDialogOpen(false);
      toast({
        title: "Gerente criado",
        description: "O gerente foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar gerente",
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
    }: {
      id: string;
      values: GerenteFormValues;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: values.nome,
          loja_id: values.loja_id,
          telefone: values.telefone,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerentes"] });
      setIsDialogOpen(false);
      setEditingGerente(null);
      toast({
        title: "Gerente atualizado",
        description: "O gerente foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar gerente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Call edge function to delete user securely
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: id },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerentes"] });
      toast({
        title: "Gerente excluído",
        description: "O gerente foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir gerente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (values: GerenteFormValues) => {
    if (editingGerente) {
      await updateMutation.mutateAsync({ id: editingGerente.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleEdit = (gerente: Gerente) => {
    setEditingGerente(gerente);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleOpenDialog = () => {
    setEditingGerente(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGerente(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Gerentes</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre gerentes e vincule-os às lojas
          </p>
        </div>
        <Button onClick={handleOpenDialog} disabled={lojas.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Gerente
        </Button>
      </div>

      {lojas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          Cadastre ao menos uma loja antes de criar gerentes.
        </div>
      )}

      <GerentesList
        gerentes={gerentes}
        lojas={lojas}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoadingGerentes || isLoadingLojas}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGerente ? "Editar Gerente" : "Novo Gerente"}
            </DialogTitle>
          </DialogHeader>
          <GerenteForm
            defaultValues={editingGerente || undefined}
            lojas={lojas}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
