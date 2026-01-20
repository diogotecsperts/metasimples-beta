import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminForm, type AdminFormValues, type AdminEditValues, type Admin } from "./AdminForm";
import { AdminsList } from "./AdminsList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { registrarAuditLog } from "@/lib/auditLog";

const MASTER_ADMIN_ID = 'ca936b16-8a15-43f4-976d-6be91e294099';

export function AdminsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: values.email,
          password: values.senha,
          nome: values.nome,
          username: values.username,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { adminId: data?.userId, nome: values.nome };
    },
    onSuccess: async ({ adminId, nome }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "create",
        entity: "admin",
        entityId: adminId,
        entityName: nome,
      });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setIsDialogOpen(false);
      toast({ title: "Administrador criado", description: "O administrador foi criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar administrador", description: error.message, variant: "destructive" });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: AdminEditValues & { userId: string; adminOriginal: Admin }) => {
      const { data, error } = await supabase.functions.invoke('update-admin', {
        body: {
          userId: values.userId,
          nome: values.nome,
          email: values.email,
          username: values.username,
          senha: values.senha || undefined,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { 
        id: values.userId, 
        nome: values.nome,
        valoresAnteriores: {
          nome: values.adminOriginal.nome,
          email: values.adminOriginal.email,
          username: values.adminOriginal.username,
        },
        valoresNovos: {
          nome: values.nome,
          email: values.email,
          username: values.username,
          senhaAlterada: !!values.senha && values.senha.length > 0,
        },
      };
    },
    onSuccess: async ({ id, nome, valoresAnteriores, valoresNovos }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      
      // Construir detalhes das alterações
      const camposAlterados: string[] = [];
      const detalhes: Record<string, unknown> = {};

      if (valoresNovos.nome !== valoresAnteriores.nome) {
        camposAlterados.push("nome");
        detalhes.nome_anterior = valoresAnteriores.nome;
        detalhes.nome_novo = valoresNovos.nome;
      }
      if (valoresNovos.email !== valoresAnteriores.email) {
        camposAlterados.push("email");
        detalhes.email_anterior = valoresAnteriores.email;
        detalhes.email_novo = valoresNovos.email;
      }
      if (valoresNovos.username !== valoresAnteriores.username) {
        camposAlterados.push("username");
        detalhes.username_anterior = valoresAnteriores.username;
        detalhes.username_novo = valoresNovos.username;
      }

      // Indicar se senha foi alterada (sem armazenar a senha!)
      const senhaAlterada = valoresNovos.senhaAlterada;
      if (senhaAlterada) {
        camposAlterados.push("senha");
      }

      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "update",
        entity: "admin",
        entityId: id,
        entityName: nome,
        details: {
          campos_alterados: camposAlterados,
          senha_alterada: senhaAlterada,
          ...detalhes,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setIsDialogOpen(false);
      setEditingAdmin(null);
      toast({ title: "Administrador atualizado", description: "Os dados foram atualizados com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar administrador", description: error.message, variant: "destructive" });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { id, nome };
    },
    onSuccess: async ({ id, nome }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "delete",
        entity: "admin",
        entityId: id,
        entityName: nome,
      });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast({ title: "Administrador excluído", description: "O administrador foi excluído com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir administrador", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = async (values: AdminFormValues | AdminEditValues) => {
    if (editingAdmin) {
      await updateMutation.mutateAsync({ 
        ...values, 
        userId: editingAdmin.id,
        adminOriginal: editingAdmin,
      } as AdminEditValues & { userId: string; adminOriginal: Admin });
    } else {
      await createMutation.mutateAsync(values as AdminFormValues);
    }
  };

  const handleDelete = async (id: string) => {
    const admin = admins.find((a) => a.id === id);
    await deleteMutation.mutateAsync({ id, nome: admin?.nome || "" });
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingAdmin(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAdmin(null);
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

      <AdminsList 
        admins={admins} 
        onDelete={handleDelete}
        onEdit={handleEdit}
        isLoading={isLoading} 
        masterAdminId={MASTER_ADMIN_ID} 
      />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAdmin ? "Editar Administrador" : "Novo Administrador"}
            </DialogTitle>
          </DialogHeader>
          <AdminForm 
            onSubmit={handleSubmit} 
            onCancel={handleCloseDialog} 
            isSubmitting={editingAdmin ? updateMutation.isPending : createMutation.isPending}
            initialData={editingAdmin}
            mode={editingAdmin ? 'edit' : 'create'}
          />
        </DialogContent>
      </Dialog>
    </div>;
}