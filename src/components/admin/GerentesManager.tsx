import { useState } from "react";
import { Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GerenteForm, type GerenteFormValues, type Gerente } from "./GerenteForm";
import { GerentesList } from "./GerentesList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { registrarAuditLog } from "@/lib/auditLog";

type Loja = {
  id: string;
  nome: string;
};

// Mapa de telefone -> contact_id do SendPulse (espelhado da edge function)
const KNOWN_CONTACTS: Record<string, string> = {
  "+5582981627838": "69322fead2b7eee6000b2336", // Diogo
  "+5587981757169": "69370bb93debac0d790a7a42", // Thiago
  "+5587981244339": "695549a0143b1c873907e63a", // Lais
  "+5587999443311": "695549a0143b1c873907e63b", // Evandro
  "+5581984415469": "695549a0143b1c873907e63c", // Raiane
  "+5581985538572": "695549a0143b1c873907e63d", // Murilo
  "+5587991364316": "695549a0143b1c873907e63e", // Alice
  "+5587981578652": "695549a0143b1c873907e63f", // Caio
  "+5587996274416": "695549a0143b1c873907e640", // Tiago
  "+5587988166174": "695549a0143b1c873907e641", // Cida
  "+5587988084422": "695549a0143b1c873907e642", // Poliana
  "+5587988326545": "695549a0143b1c873907e643", // Rosy
  "+5581996855926": "695549a0143b1c873907e639", // Matheus
};

function normalizePhoneNumber(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return `+${digits}`;
  return `+55${digits}`;
}

export function GerentesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGerente, setEditingGerente] = useState<Gerente | null>(null);
  const [showTechnicalInfo, setShowTechnicalInfo] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
          username: values.username,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { gerenteId: data?.userId, nome: values.nome };
    },
    onSuccess: async ({ gerenteId, nome }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "create",
        entity: "gerente",
        entityId: gerenteId,
        entityName: nome,
      });

      // Sincronizar novo gerente com SendPulse (fire-and-forget)
      if (gerenteId) {
        supabase.functions.invoke('sync-sendpulse-contacts', {
          body: { userIds: [gerenteId], userType: 'gerente' }
        }).then(({ data, error }) => {
          if (error) {
            console.warn('[GerentesManager] Erro ao sincronizar SendPulse:', error);
          } else {
            console.log('[GerentesManager] SendPulse sincronizado:', data);
          }
        }).catch(err => {
          console.warn('[GerentesManager] Erro ao sincronizar SendPulse:', err);
        });
      }

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
          username: values.username || null,
        })
        .eq("id", id);

      if (error) throw error;
      return { id, nome: values.nome };
    },
    onSuccess: async ({ id, nome }) => {
      // Registrar log de auditoria
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Admin",
        userRole: "admin",
        action: "update",
        entity: "gerente",
        entityId: id,
        entityName: nome,
      });

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
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      // Call edge function to delete user securely
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: id },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
        entity: "gerente",
        entityId: id,
        entityName: nome,
      });

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
    const gerente = gerentes.find((g) => g.id === id);
    await deleteMutation.mutateAsync({ id, nome: gerente?.nome || "" });
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTechnicalInfo(true)}>
            <Info className="h-4 w-4 mr-2" />
            Info Técnica
          </Button>
          <Button onClick={handleOpenDialog} disabled={lojas.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Gerente
          </Button>
        </div>
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
            key={editingGerente?.id || 'new'}
            defaultValues={editingGerente || undefined}
            lojas={lojas}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Informações Técnicas */}
      <Dialog open={showTechnicalInfo} onOpenChange={setShowTechnicalInfo}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Informações Técnicas dos Gerentes</DialogTitle>
            <DialogDescription>
              IDs e configurações internas para referência técnica
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Profile ID (Supabase)</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone Normalizado</TableHead>
                  <TableHead>Contact ID (SendPulse)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gerentes.map((gerente) => {
                  const normalizedPhone = normalizePhoneNumber(gerente.telefone);
                  const contactId = KNOWN_CONTACTS[normalizedPhone] || "Não configurado";
                  return (
                    <TableRow key={gerente.id}>
                      <TableCell className="font-mono text-xs">{gerente.id}</TableCell>
                      <TableCell>{gerente.nome}</TableCell>
                      <TableCell className="font-mono text-sm">{normalizedPhone || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {contactId !== "Não configurado" ? (
                          <span className="text-green-600 dark:text-green-400">{contactId}</span>
                        ) : (
                          <span className="text-muted-foreground">{contactId}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
