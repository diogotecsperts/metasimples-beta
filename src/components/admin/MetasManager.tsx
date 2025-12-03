import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MetasManager() {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const [periodoSelecionado, setPeriodoSelecionado] = useState({
    mes: mesAtual,
    ano: anoAtual,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAtual = periodoSelecionado.mes === mesAtual && periodoSelecionado.ano === anoAtual;

  // Fetch períodos com dados históricos
  const { data: periodosComDados = [] } = useQuery({
    queryKey: ["metas-periodos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("mes, ano")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) throw error;

      // Retorna períodos únicos
      const uniquePeriodos = data.reduce((acc, curr) => {
        const key = `${curr.ano}-${curr.mes}`;
        if (!acc.find((p) => `${p.ano}-${p.mes}` === key)) {
          acc.push(curr);
        }
        return acc;
      }, [] as { mes: number; ano: number }[]);

      return uniquePeriodos;
    },
  });

  // Gerar opções do select: mês atual + meses com dados históricos
  const opcoesPeriodo = useMemo(() => {
    const opcoes: { mes: number; ano: number; label: string }[] = [];

    // Sempre incluir mês atual
    opcoes.push({
      mes: mesAtual,
      ano: anoAtual,
      label: `${MESES[mesAtual - 1]} ${anoAtual} (atual)`,
    });

    // Adicionar meses com dados (exceto atual se já estiver)
    periodosComDados.forEach((p) => {
      if (!(p.mes === mesAtual && p.ano === anoAtual)) {
        opcoes.push({
          mes: p.mes,
          ano: p.ano,
          label: `${MESES[p.mes - 1]} ${p.ano}`,
        });
      }
    });

    return opcoes;
  }, [periodosComDados, mesAtual, anoAtual]);

  // Fetch metas filtradas por período
  const { data: metas = [], isLoading: isLoadingMetas } = useQuery({
    queryKey: ["metas", periodoSelecionado.mes, periodoSelecionado.ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("*")
        .eq("mes", periodoSelecionado.mes)
        .eq("ano", periodoSelecionado.ano)
        .order("created_at", { ascending: false });

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
      const loja = lojas.find((l) => l.id === values.loja_id);
      if (!loja) throw new Error("Loja não encontrada");

      const metaDiaria = calcularMetaDiaria(
        values.meta_mensal,
        loja.tipo_operacional,
        values.mes,
        values.ano
      );

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
      queryClient.invalidateQueries({ queryKey: ["metas-periodos"] });
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
      const loja = lojas.find((l) => l.id === values.loja_id);
      if (!loja) throw new Error("Loja não encontrada");

      const metaDiaria = calcularMetaDiaria(
        values.meta_mensal,
        loja.tipo_operacional,
        values.mes,
        values.ano
      );

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
      queryClient.invalidateQueries({ queryKey: ["metas-periodos"] });
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
      queryClient.invalidateQueries({ queryKey: ["metas-periodos"] });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Gerenciar Metas Mensais</h3>
          <p className="text-sm text-muted-foreground">
            Configure metas mensais e visualize a meta diária calculada
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={`${periodoSelecionado.ano}-${periodoSelecionado.mes}`}
            onValueChange={(value) => {
              const [ano, mes] = value.split("-").map(Number);
              setPeriodoSelecionado({ mes, ano });
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {opcoesPeriodo.map((op) => (
                <SelectItem
                  key={`${op.ano}-${op.mes}`}
                  value={`${op.ano}-${op.mes}`}
                >
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleOpenDialog} disabled={lojas.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        </div>
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
        isAtual={isAtual}
        mes={periodoSelecionado.mes}
        ano={periodoSelecionado.ano}
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
