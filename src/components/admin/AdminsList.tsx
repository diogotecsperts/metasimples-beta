import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  
  const isMasterAdmin = (email: string) => email === masterAdminEmail;
  const isSelfDelete = deletingAdmin?.email === user?.email;

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
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeletingAdmin(admin)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-background">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isSelfDelete ? "⚠️ Auto-exclusão de administrador" : "Confirmar exclusão"}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              {isSelfDelete ? (
                                <>
                                  <p className="font-semibold text-destructive">
                                    Você está prestes a deletar sua própria conta de administrador!
                                  </p>
                                  <p>
                                    Após confirmar, você será imediatamente desconectado e perderá todo o acesso administrativo ao sistema. Esta ação não pode ser desfeita.
                                  </p>
                                </>
                              ) : (
                                <p>
                                  Tem certeza que deseja excluir o administrador{" "}
                                  <strong>{admin.nome}</strong>? Esta ação não pode ser desfeita.
                                </p>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingAdmin(null)}>
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => {
                                onDelete(admin.id);
                                setDeletingAdmin(null);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isSelfDelete ? "Confirmar auto-exclusão" : "Excluir"}
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