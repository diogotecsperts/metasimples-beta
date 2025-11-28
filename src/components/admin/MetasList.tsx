import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type Meta = {
  id: string;
  loja_id: string;
  mes: number;
  ano: number;
  meta_mensal: number;
  meta_diaria_calculada: number;
  created_at: string;
  updated_at: string;
};

export type Loja = {
  id: string;
  nome: string;
};

type MetasListProps = {
  metas: Meta[];
  lojas: Loja[];
  onEdit: (meta: Meta) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
};

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function MetasList({
  metas,
  lojas,
  onEdit,
  onDelete,
  isLoading,
}: MetasListProps) {
  const getLojaName = (lojaId: string) => {
    const loja = lojas.find((l) => l.id === lojaId);
    return loja?.nome || "—";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando metas...
      </div>
    );
  }

  if (metas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma meta cadastrada ainda.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loja</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Meta Mensal</TableHead>
            <TableHead className="text-right">Meta Diária</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metas.map((meta) => (
            <TableRow key={meta.id}>
              <TableCell className="font-medium">
                {getLojaName(meta.loja_id)}
              </TableCell>
              <TableCell>
                {MESES[meta.mes - 1]} {meta.ano}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(meta.meta_mensal)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(meta.meta_diaria_calculada)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(meta)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-background">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir a meta de{" "}
                          <strong>
                            {MESES[meta.mes - 1]}/{meta.ano}
                          </strong>{" "}
                          para <strong>{getLojaName(meta.loja_id)}</strong>?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(meta.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
