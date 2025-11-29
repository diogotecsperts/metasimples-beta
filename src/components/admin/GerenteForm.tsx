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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const gerenteFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  loja_id: z.string().uuid("Selecione uma loja válida"),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional(),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
});

export type GerenteFormValues = z.infer<typeof gerenteFormSchema>;

export type Gerente = {
  id: string;
  nome: string;
  loja_id: string | null;
  telefone: string | null;
  created_at: string;
};

export type Loja = {
  id: string;
  nome: string;
};

type GerenteFormProps = {
  defaultValues?: Gerente;
  lojas: Loja[];
  onSubmit: (values: GerenteFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
};

export function GerenteForm({
  defaultValues,
  lojas,
  onSubmit,
  onCancel,
  isSubmitting,
}: GerenteFormProps) {
  const isEditing = !!defaultValues;

  const form = useForm<GerenteFormValues>({
    resolver: zodResolver(gerenteFormSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      loja_id: defaultValues?.loja_id || "",
      telefone: defaultValues?.telefone || "",
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
              <FormLabel>Nome do Gerente</FormLabel>
              <FormControl>
                <Input placeholder="Digite o nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="loja_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Loja</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>
                      {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telefone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone (opcional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="(81) 99999-9999"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEditing && (
          <>
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
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Salvando..."
              : isEditing
              ? "Atualizar"
              : "Criar Gerente"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
