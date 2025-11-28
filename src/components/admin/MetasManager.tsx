import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetaForm, type MetaFormValues, type Meta } from "./MetaForm";
import { MetasList } from "./MetasList";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calcularMetaDiaria } from "@/lib/calcularMetaDiaria";

type Loja = {
  id: string;
  nome: string;
  tipo_operacional: "A" | "B";
};

export function MetasManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch metas
  const { data: metas = [], isLoading: isLoadingMetas } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;
      return data as Meta[];
    },
  });

  // Fetch lojas
  const { data: lojas = [], isLoading: isLoadingLojas } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, tipo_operacional")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Loja[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: MetaFormValues) => {
      // Encontrar loja para pegar tipo_operacional
      const loja = lojas.find((l) => l.id === values.loja_id);
      if (!loja) throw new Error("Loja não encontrada");

      // Calcular meta diária
      const metaDiaria = calcularMetaDiaria(
        values.meta_mensal,
        loja.tipo_operacional,
        values.mes,
        values.ano
      );

      // Inserir no banco
      const { error } = await supabase.from("metas_mensais").insert({
        loja_id: values.loja_id,
        mes: values.mes,
        ano: values.ano,
        meta_mensal: values.meta_mensal,
        meta_diaria_calculada: metaDiaria,
      });

      if (error) throw error;

      return { metaDiaria };
    },
    onSuccess: ({ metaDiaria }) => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsDialogOpen(false);
      toast({
        title: "Meta criada com sucesso",
        description: `Meta diária calculada: ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(metaDiaria)}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar meta",
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
      values: MetaFormValues;
    }) => {
      // Encontrar loja para pegar tipo_operacional
      const loja = lojas.find((l) => l.id === values.loja_id);
      if (!loja) throw new Error("Loja não encontrada");

      // Calcular meta diária
      const metaDiaria = calcularMetaDiaria(
        values.meta_mensal,
        loja.tipo_operacional,
        values.mes,
        values.ano
      );

      // Atualizar no banco
      const { error } = await supabase
        .from("metas_mensais")
        .update({
          loja_id: values.loja_id,
          mes: values.mes,
          ano: values.ano,
          meta_mensal: values.meta_mensal,
          meta_diaria_calculada: metaDiaria,
        })
        .eq("id", id);

      if (error) throw error;

      return { metaDiaria };
    },
    onSuccess: ({ metaDiaria }) => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setIsDialogOpen(false);
      setEditingMeta(null);
      toast({
        title: "Meta atualizada com sucesso",
        description: `Meta diária calculada: ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(metaDiaria)}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("metas_mensais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast({
        title: "Meta excluída",
        description: "A meta foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (values: MetaFormValues) => {
    if (editingMeta) {
      await updateMutation.mutateAsync({ id: editingMeta.id, values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta(meta);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleOpenDialog = () => {
    setEditingMeta(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMeta(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Metas Mensais</h3>
          <p className="text-sm text-muted-foreground">
            Configure metas mensais e visualize a meta diária calculada
          </p>
        </div>
        <Button onClick={handleOpenDialog} disabled={lojas.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {lojas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          Cadastre ao menos uma loja antes de criar metas.
        </div>
      )}

      <MetasList
        metas={metas}
        lojas={lojas}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoadingMetas || isLoadingLojas}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMeta ? "Editar Meta" : "Nova Meta"}
            </DialogTitle>
          </DialogHeader>
          <MetaForm
            defaultValues={editingMeta || undefined}
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
