import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const lancamentoSchema = z.object({
  valor_acumulado: z.coerce
    .number()
    .min(0, "Valor deve ser maior ou igual a zero")
    .max(1000000, "Valor muito alto. Verifique o valor digitado.")
    .refine((val) => {
      // Verificar se tem no máximo 2 casas decimais
      const str = val.toString();
      const decimalPart = str.split('.')[1];
      return !decimalPart || decimalPart.length <= 2;
    }, "Valor deve ter no máximo 2 casas decimais"),
});

type LancamentoFormValues = z.infer<typeof lancamentoSchema>;

type LancamentoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  horario: string;
  valorAtual?: number;
  onSubmit: (valor: number) => Promise<void>;
  isSubmitting: boolean;
};

export function LancamentoDialog({
  isOpen,
  onClose,
  horario,
  valorAtual,
  onSubmit,
  isSubmitting,
}: LancamentoDialogProps) {
  const form = useForm<LancamentoFormValues>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      valor_acumulado: valorAtual || 0,
    },
  });

  // Resetar form quando dialog abrir com novo valor
  useEffect(() => {
    if (isOpen) {
      form.reset({
        valor_acumulado: valorAtual || 0,
      });
    }
  }, [isOpen, valorAtual, form]);

  const handleSubmit = async (values: LancamentoFormValues) => {
    await onSubmit(values.valor_acumulado);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançamento - {horario}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="valor_acumulado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Acumulado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      autoFocus
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Digite o valor total acumulado até este horário.
                  </p>
                </FormItem>
              )}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
