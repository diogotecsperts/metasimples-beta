import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTipoOperacionalLabel } from "@/lib/tipoOperacionalLabels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { useState } from "react";

export interface Loja {
  id: string;
  nome: string;
  tipo_operacional: "A" | "B";
  possui_fechamento_tardio: boolean;
  created_at: string;
}

interface LojasListProps {
  lojas: Loja[];
  onEdit: (loja: Loja) => void;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function LojasList({ lojas, onEdit, onDelete, isLoading }: LojasListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setIsDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <div className="text-center text-muted-foreground">
          Carregando lojas...
        </div>
      </div>
    );
  }

  if (lojas.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <div className="text-center text-muted-foreground">
          Nenhuma loja cadastrada ainda.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo Operacional</TableHead>
              <TableHead>Fechamento Tardio</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lojas.map((loja) => (
              <TableRow key={loja.id}>
                <TableCell className="font-medium">{loja.nome}</TableCell>
                <TableCell>
                  <Badge variant={loja.tipo_operacional === "A" ? "default" : "secondary"}>
                    {getTipoOperacionalLabel(loja.tipo_operacional)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {loja.possui_fechamento_tardio ? (
                    <Badge variant="outline">Sim</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Não</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(loja)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(loja.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
