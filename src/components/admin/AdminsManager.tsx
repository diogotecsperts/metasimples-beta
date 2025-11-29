import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminForm, type AdminFormValues, type Admin } from "./AdminForm";
import { AdminsList } from "./AdminsList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const MASTER_ADMIN_EMAIL = 'diogomixcds@gmail.com';
export function AdminsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // Fetch admins via edge function
  const {
    data: admins = [],
    isLoading
  } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.functions.invoke('list-admins');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data.admins || []) as Admin[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      if (!values.email || !values.senha) {
        throw new Error("Email e senha são obrigatórios");
      }

      // Call edge function to create admin securely
      const {
        data,
        error
      } = await supabase.functions.invoke('create-admin', {
        body: {
          email: values.email,
          password: values.senha,
          nome: values.nome
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admins"]
      });
      setIsDialogOpen(false);
      toast({
        title: "Administrador criado",
        description: "O administrador foi criado com sucesso."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar administrador",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Call edge function to delete user securely
      const {
        data,
        error
      } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: id
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admins"]
      });
      toast({
        title: "Administrador excluído",
        description: "O administrador foi excluído com sucesso."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir administrador",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleSubmit = async (values: AdminFormValues) => {
    await createMutation.mutateAsync(values);
  };
  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };
  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };
  return <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Administradores</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre administradores do sistema
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Admin
        </Button>
      </div>

      <AdminsList admins={admins} onDelete={handleDelete} isLoading={isLoading} masterAdminEmail={MASTER_ADMIN_EMAIL} />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Administrador</DialogTitle>
          </DialogHeader>
          <AdminForm onSubmit={handleSubmit} onCancel={handleCloseDialog} isSubmitting={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>;
}