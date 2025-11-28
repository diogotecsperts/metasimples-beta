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

const metaFormSchema = z.object({
  loja_id: z.string().uuid("Selecione uma loja válida"),
  mes: z.coerce
    .number()
    .min(1, "Mês deve ser entre 1 e 12")
    .max(12, "Mês deve ser entre 1 e 12"),
  ano: z.coerce
    .number()
    .min(2020, "Ano inválido")
    .max(2100, "Ano inválido"),
  meta_mensal: z.coerce
    .number()
    .positive("Meta mensal deve ser maior que zero"),
});

export type MetaFormValues = z.infer<typeof metaFormSchema>;

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
  tipo_operacional: "A" | "B";
};

type MetaFormProps = {
  defaultValues?: Meta;
  lojas: Loja[];
  onSubmit: (values: MetaFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
};

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function MetaForm({
  defaultValues,
  lojas,
  onSubmit,
  onCancel,
  isSubmitting,
}: MetaFormProps) {
  const isEditing = !!defaultValues;
  const currentYear = new Date().getFullYear();

  const form = useForm<MetaFormValues>({
    resolver: zodResolver(metaFormSchema),
    defaultValues: {
      loja_id: defaultValues?.loja_id || "",
      mes: defaultValues?.mes || new Date().getMonth() + 1,
      ano: defaultValues?.ano || currentYear,
      meta_mensal: defaultValues?.meta_mensal || 0,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mês</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-background z-50">
                    {MESES.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
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
            name="ano"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={currentYear.toString()}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="meta_mensal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meta Mensal (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
              : isEditing
              ? "Atualizar"
              : "Criar Meta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
