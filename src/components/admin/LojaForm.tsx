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
import { Checkbox } from "@/components/ui/checkbox";

const lojaFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome da loja é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  tipo_operacional: z.enum(["A", "B"], {
    required_error: "Selecione o tipo operacional",
  }),
  possui_fechamento_tardio: z.boolean().default(false),
});

export type LojaFormValues = z.infer<typeof lojaFormSchema>;

interface LojaFormProps {
  defaultValues?: Partial<LojaFormValues>;
  onSubmit: (values: LojaFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function LojaForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: LojaFormProps) {
  const form = useForm<LojaFormValues>({
    resolver: zodResolver(lojaFormSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      tipo_operacional: defaultValues?.tipo_operacional || undefined,
      possui_fechamento_tardio: defaultValues?.possui_fechamento_tardio || false,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Loja</FormLabel>
              <FormControl>
                <Input
                  placeholder="Digite o nome da loja"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipo_operacional"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo Operacional</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo operacional" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="A">Dom a Dom (Domingo a Domingo)</SelectItem>
                  <SelectItem value="B">Seg a Sáb (Segunda a Sábado)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="possui_fechamento_tardio"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Possui fechamento tardio (23:00)?
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
