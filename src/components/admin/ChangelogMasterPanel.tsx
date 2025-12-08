import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Send, 
  Calendar,
  CheckCircle2,
  Loader2,
  HelpCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChangelogItemForm } from "./ChangelogItemForm";
import { ChangelogEmailDialog } from "./ChangelogEmailDialog";

type ChangelogItem = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "disponivel" | "desenvolvimento" | "indeterminado";
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
};

const categoriaConfig = {
  disponivel: {
    label: "Disponível",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  desenvolvimento: {
    label: "Em desenvolvimento",
    icon: Loader2,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  indeterminado: {
    label: "Indeterminado",
    icon: HelpCircle,
    color: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
};

export function ChangelogMasterPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ChangelogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ChangelogItem | null>(null);
  const [emailDialogItem, setEmailDialogItem] = useState<ChangelogItem | null>(null);

  // Buscar todos os itens (incluindo não publicados - Master vê tudo)
  const { data: items, isLoading } = useQuery({
    queryKey: ["changelog-items-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ChangelogItem[];
    },
  });

  // Deletar item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("changelog_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-items-master"] });
      queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
      queryClient.invalidateQueries({ queryKey: ["changelog-unread-count"] });
      toast({ title: "Item removido com sucesso" });
      setDeletingItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao remover item", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Publicar imediatamente
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("changelog_items")
        .update({ published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-items-master"] });
      queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
      queryClient.invalidateQueries({ queryKey: ["changelog-unread-count"] });
      toast({ title: "Item publicado com sucesso" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao publicar item", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (item: ChangelogItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(null);
    queryClient.invalidateQueries({ queryKey: ["changelog-items-master"] });
    queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
    queryClient.invalidateQueries({ queryKey: ["changelog-unread-count"] });
  };

  const getStatusBadge = (item: ChangelogItem) => {
    if (item.published_at && new Date(item.published_at) <= new Date()) {
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Publicado</Badge>;
    }
    if (item.scheduled_at) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 gap-1">
          <Calendar className="h-3 w-3" />
          Agendado
        </Badge>
      );
    }
    return <Badge variant="outline" className="bg-slate-500/10 text-slate-600">Rascunho</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (showForm) {
    return (
      <ChangelogItemForm
        item={editingItem}
        onSuccess={handleFormSuccess}
        onCancel={() => {
          setShowForm(false);
          setEditingItem(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Novidades</h3>
          <p className="text-sm text-muted-foreground">
            Adicione, edite e publique atualizações do sistema
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {items && items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const config = categoriaConfig[item.categoria];
                const Icon = config.icon;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.titulo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={config.color}>
                        <Icon className={`h-3 w-3 mr-1 ${item.categoria === "desenvolvimento" ? "animate-spin" : ""}`} />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.published_at 
                        ? format(new Date(item.published_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : item.scheduled_at
                          ? format(new Date(item.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Publicar (se não publicado) */}
                        {!item.published_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => publishMutation.mutate(item.id)}
                            disabled={publishMutation.isPending}
                            title="Publicar agora"
                          >
                            <Clock className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        
                        {/* Enviar email (apenas se publicado) */}
                        {item.published_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEmailDialogItem(item)}
                            title="Enviar por email"
                          >
                            <Send className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">Nenhum item cadastrado</p>
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deletingItem?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de envio de email */}
      {emailDialogItem && (
        <ChangelogEmailDialog
          item={emailDialogItem}
          onClose={() => setEmailDialogItem(null)}
        />
      )}
    </div>
  );
}
