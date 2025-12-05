import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const lancamentoSchema = z.object({
  valor_acumulado: z
    .number({
      required_error: "O valor é obrigatório",
      invalid_type_error: "Digite um valor numérico",
    })
    .min(0, "O valor não pode ser negativo")
    .max(1000000, "O valor máximo é R$ 1.000.000")
    .refine(
      (val) => Number.isFinite(val) && Number(val.toFixed(2)) === val,
      "Use no máximo 2 casas decimais"
    ),
});

type LancamentoFormValues = z.infer<typeof lancamentoSchema>;

interface AdminLancamentoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  horario: string;
  valorAtual?: number;
  onSubmit: (valor: number) => Promise<void>;
  isSubmitting: boolean;
  lojaNome: string;
  data: Date;
  isEdicao: boolean;
}

export function AdminLancamentoDialog({
  isOpen,
  onClose,
  horario,
  valorAtual,
  onSubmit,
  isSubmitting,
  lojaNome,
  data,
  isEdicao,
}: AdminLancamentoDialogProps) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataSelecionada = new Date(data);
  dataSelecionada.setHours(0, 0, 0, 0);
  const isDiaAnterior = dataSelecionada < hoje;

  const form = useForm<LancamentoFormValues>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      valor_acumulado: valorAtual,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        valor_acumulado: valorAtual,
      });
    }
  }, [isOpen, valorAtual, form]);

  const handleSubmit = async (values: LancamentoFormValues) => {
    await onSubmit(values.valor_acumulado);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Shield className="h-3 w-3 mr-1" />
              Alteração Administrativa
            </Badge>
          </div>
          <DialogTitle className="text-lg">
            {isEdicao ? "Editar" : "Registrar"} Lançamento
          </DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-medium text-foreground">{lojaNome}</span>
            {" · "}
            <span>{horario}</span>
            {" · "}
            <span>{format(data, "dd 'de' MMMM", { locale: ptBR })}</span>
          </DialogDescription>
        </DialogHeader>

        {isDiaAnterior && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              Você está {isEdicao ? "editando" : "criando"} um lançamento de <strong>dia anterior</strong>. 
              Essa alteração pode causar divergências com relatórios já enviados.
            </p>
          </div>
        )}

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
                      max="1000000"
                      placeholder="0.00"
                      autoFocus
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdicao && valorAtual !== undefined && (
              <p className="text-xs text-muted-foreground">
                Valor anterior: R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
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
