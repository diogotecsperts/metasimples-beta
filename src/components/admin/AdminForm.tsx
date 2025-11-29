import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const adminFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  username: z.string()
    .min(3, "Username deve ter no mínimo 3 caracteres")
    .max(20, "Username deve ter no máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Username deve conter apenas letras, números e underscore"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const adminEditSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  username: z.string()
    .min(3, "Username deve ter no mínimo 3 caracteres")
    .max(20, "Username deve ter no máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Username deve conter apenas letras, números e underscore"),
  email: z.string().email("Email inválido"),
  senha: z.string().optional().or(z.literal('')),
});

export type AdminFormValues = z.infer<typeof adminFormSchema>;
export type AdminEditValues = z.infer<typeof adminEditSchema>;

export type Admin = {
  id: string;
  nome: string;
  username?: string;
  email: string;
  created_at: string;
};

type AdminFormProps = {
  onSubmit: (values: AdminFormValues | AdminEditValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  initialData?: Admin | null;
  mode?: 'create' | 'edit';
};

export function AdminForm({
  onSubmit,
  onCancel,
  isSubmitting,
  initialData,
  mode = 'create',
}: AdminFormProps) {
  const isEditMode = mode === 'edit';
  
  const form = useForm<AdminFormValues | AdminEditValues>({
    resolver: zodResolver(isEditMode ? adminEditSchema : adminFormSchema),
    defaultValues: isEditMode && initialData ? {
      nome: initialData.nome,
      username: initialData.username || "",
      email: initialData.email,
      senha: "",
    } : {
      nome: "",
      username: "",
      email: "",
      senha: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Administrador</FormLabel>
              <FormControl>
                <Input placeholder="Digite o nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID de Acesso</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Ex: admin123"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="senha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isEditMode ? "Nova Senha (opcional)" : "Senha"}
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={isEditMode ? "Deixe em branco para manter a atual" : "Mínimo 6 caracteres"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting 
              ? "Salvando..." 
              : isEditMode 
                ? "Salvar Alterações" 
                : "Criar Administrador"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}