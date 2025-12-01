import { Mail, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
export function RelatoriosAutomaticos() {
  const horarios = [{
    id: "10:00",
    label: "10:00"
  }, {
    id: "14:00",
    label: "14:00"
  }, {
    id: "16:00",
    label: "16:00"
  }, {
    id: "19:00",
    label: "19:00"
  }, {
    id: "23:00",
    label: "23:00"
  }];
  return <div className="bg-card border rounded-xl p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-xl md:text-2xl font-semibold">Relatórios Automáticos</h2>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="gap-1">
                <Info className="h-3 w-3" />
                Em desenvolvimento
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Funcionalidade em desenvolvimento. Em breve você poderá receber relatórios automáticos por email nos horários de lançamento.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <p className="text-sm text-muted-foreground mb-4">Receba relatórios consolidados automaticamente nos horários de lançamento</p>

      {/* Horários */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-3">Horários de Envio:</p>
        <div className="flex flex-wrap gap-4">
          {horarios.map(horario => <div key={horario.id} className="flex items-center gap-2">
              <Checkbox id={horario.id} disabled className="opacity-50 cursor-not-allowed" />
              <label htmlFor={horario.id} className="text-sm opacity-50 cursor-not-allowed">
                {horario.label}
              </label>
            </div>)}
        </div>
      </div>

      {/* Email Input */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-2 block opacity-50">
          Email de Destino:
        </label>
        <Input type="email" placeholder="seu@email.com" disabled className="opacity-50 cursor-not-allowed" />
      </div>

      {/* Botão Salvar */}
      <Button disabled className="opacity-50 cursor-not-allowed">
        Salvar Configuração
      </Button>
    </div>;
}