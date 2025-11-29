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

export type Gerente = {
  id: string;
  nome: string;
  loja_id: string | null;
  telefone: string | null;
  username: string | null;
  created_at: string;
};

export type Loja = {
  id: string;
  nome: string;
};

type GerentesListProps = {
  gerentes: Gerente[];
  lojas: Loja[];
  onEdit: (gerente: Gerente) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
};

export function GerentesList({
  gerentes,
  lojas,
  onEdit,
  onDelete,
  isLoading,
}: GerentesListProps) {
  const getLojaName = (lojaId: string | null) => {
    if (!lojaId) return "—";
    const loja = lojas.find((l) => l.id === lojaId);
    return loja?.nome || "—";
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando gerentes...
      </div>
    );
  }

  if (gerentes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum gerente cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>ID de Acesso</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
          {gerentes.map((gerente) => (
            <TableRow key={gerente.id}>
              <TableCell className="font-medium">{gerente.nome}</TableCell>
              <TableCell>{getLojaName(gerente.loja_id)}</TableCell>
              <TableCell className="font-mono text-sm">{gerente.username || "—"}</TableCell>
              <TableCell>{gerente.telefone || "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(gerente)}
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
                          Tem certeza que deseja excluir o gerente{" "}
                          <strong>{gerente.nome}</strong>? Esta ação não pode
                          ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(gerente.id)}>
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
