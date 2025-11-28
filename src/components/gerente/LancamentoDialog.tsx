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
    .nonnegative("Valor deve ser maior ou igual a zero"),
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

  const handleSubmit = async (values: LancamentoFormValues) => {
    await onSubmit(values.valor_acumulado);
    form.reset();
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
