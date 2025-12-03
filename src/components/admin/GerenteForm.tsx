import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const gerenteFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  loja_id: z.string().uuid("Selecione uma loja válida"),
  telefone: z.string().optional(),
  username: z.union([z.literal(""), z.string().min(3, "Username deve ter no mínimo 3 caracteres").max(20, "Username deve ter no máximo 20 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Username deve conter apenas letras, números e underscore")]),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional().or(z.literal(""))
});
export type GerenteFormValues = z.infer<typeof gerenteFormSchema>;
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
  isSubmitting
}: GerenteFormProps) {
  const isEditing = !!defaultValues;
  const form = useForm<GerenteFormValues>({
    resolver: zodResolver(gerenteFormSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      loja_id: defaultValues?.loja_id || "",
      telefone: defaultValues?.telefone || "",
      username: defaultValues?.username || "",
      email: "",
      senha: ""
    }
  });
  useEffect(() => {
    form.reset({
      nome: defaultValues?.nome || "",
      loja_id: defaultValues?.loja_id || "",
      telefone: defaultValues?.telefone || "",
      username: defaultValues?.username || "",
      email: "",
      senha: ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);
  return <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="nome" render={({
        field
      }) => <FormItem>
              <FormLabel>Nome do Gerente</FormLabel>
              <FormControl>
                <Input placeholder="Digite o nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <FormField control={form.control} name="loja_id" render={({
        field
      }) => <FormItem>
              <FormLabel>Loja</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  {lojas.map(loja => <SelectItem key={loja.id} value={loja.id}>
                      {loja.nome}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>} />

        <FormField control={form.control} name="telefone" render={({
        field
      }) => <FormItem>
              <FormLabel>Telefone (opcional)</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="(87) 99999-9999" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <FormField control={form.control} name="username" render={({
        field
      }) => <FormItem>
              <FormLabel>ID de Acesso {!isEditing && "(obrigatório)"}</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Ex: maria123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        {!isEditing && <>
            <FormField control={form.control} name="email" render={({
          field
        }) => <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />

            <FormField control={form.control} name="senha" render={({
          field
        }) => <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
          </>}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </> : isEditing ? "Atualizar" : "Criar Gerente"}
          </Button>
        </div>
      </form>
    </Form>;
}