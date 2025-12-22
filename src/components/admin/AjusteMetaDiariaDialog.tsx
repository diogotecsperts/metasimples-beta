import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { isDomingo, type AjusteDiario } from "@/lib/calcularMetaDiariaComAjustes";
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

type AjusteMetaDiariaDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  data: string;
  metaOriginal: number;
  metaAtual: number;
  ajusteExistente: AjusteDiario | null | undefined;
  previa: {
    diferenca: number;
    diasElegíveis: number;
    acrescimoporDia: number;
  } | null;
  lojaNome: string;
  onSave: (metaAjustada: number, motivo: string, aplicarTodosDomingos: boolean) => void;
  onRemove: () => void;
  isSaving: boolean;
};

export function AjusteMetaDiariaDialog({
  isOpen,
  onClose,
  data,
  metaOriginal,
  metaAtual,
  ajusteExistente,
  previa,
  lojaNome,
  onSave,
  onRemove,
  isSaving,
}: AjusteMetaDiariaDialogProps) {
  const [metaAjustada, setMetaAjustada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aplicarTodosDomingos, setAplicarTodosDomingos] = useState(false);

  const dataFormatada = format(new Date(data + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const ehDomingo = isDomingo(data);

  useEffect(() => {
    if (ajusteExistente) {
      setMetaAjustada(ajusteExistente.meta_ajustada.toString());
      setMotivo(ajusteExistente.motivo || "");
    } else {
      setMetaAjustada("");
      setMotivo("");
    }
    setAplicarTodosDomingos(false);
  }, [ajusteExistente, data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(metaAjustada.replace(/[^\d,.-]/g, "").replace(",", "."));
    if (isNaN(valor) || valor < 0) return;
    onSave(valor, motivo, aplicarTodosDomingos);
  };

  const valorDigitado = parseFloat(metaAjustada.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
  const diferenca = metaOriginal - valorDigitado;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Meta Diária</DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">{dataFormatada}</p>
          <p className="text-xs text-muted-foreground">{lojaNome}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Valores de referência */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Meta Original</p>
              <p className="font-semibold">{formatCurrency(metaOriginal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meta Atual</p>
              <p className="font-semibold">{formatCurrency(metaAtual)}</p>
            </div>
          </div>

          {/* Input de nova meta */}
          <div className="space-y-2">
            <Label htmlFor="metaAjustada">Nova Meta</Label>
            <Input
              id="metaAjustada"
              type="text"
              placeholder="Ex: 7000.00"
              value={metaAjustada}
              onChange={(e) => setMetaAjustada(e.target.value)}
              required
            />
          </div>

          {/* Input de motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input
              id="motivo"
              type="text"
              placeholder="Ex: Meio expediente"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {/* Checkbox para domingos */}
          {ehDomingo && (
            <div className="flex items-center space-x-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Checkbox
                id="aplicarDomingos"
                checked={aplicarTodosDomingos}
                onCheckedChange={(checked) => setAplicarTodosDomingos(checked as boolean)}
              />
              <Label htmlFor="aplicarDomingos" className="text-sm cursor-pointer">
                Aplicar a TODOS os domingos do mês?
              </Label>
            </div>
          )}

          {/* Prévia de redistribuição */}
          {valorDigitado > 0 && diferenca !== 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p>
                  {diferenca > 0 ? (
                    <>
                      <strong>{formatCurrency(diferenca)}</strong> será redistribuído entre os{" "}
                      <strong>{previa?.diasElegíveis || 0}</strong> dias restantes sem ajuste.
                    </>
                  ) : (
                    <>
                      <strong>{formatCurrency(Math.abs(diferenca))}</strong> será subtraído dos{" "}
                      <strong>{previa?.diasElegíveis || 0}</strong> dias restantes sem ajuste.
                    </>
                  )}
                </p>
                {previa && previa.diasElegíveis > 0 && (
                  <p className="mt-1">
                    Cada dia elegível terá{" "}
                    {diferenca > 0 ? "acréscimo" : "redução"} de{" "}
                    <strong>{formatCurrency(Math.abs(previa.acrescimoporDia))}</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {ajusteExistente && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover ajuste?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A meta deste dia voltará ao valor calculado automaticamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onRemove}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !metaAjustada}>
                {isSaving ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
