import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export type Admin = {
  id: string;
  nome: string;
  email: string;
  created_at: string;
};

type AdminsListProps = {
  admins: Admin[];
  onDelete: (id: string) => void;
  isLoading: boolean;
  masterAdminEmail: string;
};

export function AdminsList({
  admins,
  onDelete,
  isLoading,
  masterAdminEmail,
}: AdminsListProps) {
  const isMasterAdmin = (email: string) => email === masterAdminEmail;

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando administradores...
      </div>
    );
  }

  if (admins.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum administrador cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => {
            const isMaster = isMasterAdmin(admin.email);
            
            return (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">{admin.nome}</TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  {isMaster ? (
                    <Badge variant="default" className="bg-primary">
                      🔒 Master
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {isMaster ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="opacity-30 cursor-not-allowed"
                        title="Não é possível deletar o administrador master"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
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
                              Tem certeza que deseja excluir o administrador{" "}
                              <strong>{admin.nome}</strong>? Esta ação não pode
                              ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(admin.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}