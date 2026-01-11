import { useState, useEffect } from "react";
import { 
  RangeCalendar, 
  CalendarGrid, 
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell, 
  Heading, 
  Button as AriaButton 
} from "react-aria-components";
import { 
  today, 
  getLocalTimeZone, 
  CalendarDate
} from "@internationalized/date";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateRangeValue {
  start: CalendarDate;
  end: CalendarDate;
}

interface RangeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: { from: Date; to: Date }) => void;
  initialRange?: { from?: Date; to?: Date };
  maxDate?: Date;
}

export function RangeCalendarModal({
  isOpen,
  onClose,
  onApply,
  initialRange,
  maxDate
}: RangeCalendarModalProps) {
  const [range, setRange] = useState<DateRangeValue | null>(null);

  // Sincronizar com initialRange quando o modal abre
  useEffect(() => {
    if (isOpen && initialRange?.from && initialRange?.to) {
      setRange({
        start: new CalendarDate(
          initialRange.from.getFullYear(),
          initialRange.from.getMonth() + 1,
          initialRange.from.getDate()
        ),
        end: new CalendarDate(
          initialRange.to.getFullYear(),
          initialRange.to.getMonth() + 1,
          initialRange.to.getDate()
        )
      });
    } else if (isOpen) {
      setRange(null);
    }
  }, [isOpen, initialRange]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (range) {
      onApply({
        from: range.start.toDate(getLocalTimeZone()),
        to: range.end.toDate(getLocalTimeZone())
      });
    }
  };

  const maxCalendarDate = maxDate 
    ? new CalendarDate(maxDate.getFullYear(), maxDate.getMonth() + 1, maxDate.getDate())
    : today(getLocalTimeZone());

  const formatDate = (date: CalendarDate) => {
    return date.toDate(getLocalTimeZone()).toLocaleDateString("pt-BR", { 
      day: "2-digit", 
      month: "short", 
      year: "numeric" 
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - sem blur para melhor performance */}
      <div 
        className="absolute inset-0 bg-black/50 animate-modal-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 bg-card rounded-2xl shadow-2xl p-6 animate-modal-scale-in border border-border max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Selecione o período</h3>
            <p className="text-sm text-muted-foreground">
              Clique na data inicial e depois na data final
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendário React Aria */}
        <RangeCalendar
          aria-label="Selecione o período"
          value={range}
          onChange={setRange}
          maxValue={maxCalendarDate}
          className="w-full"
        >
          <header className="flex items-center justify-between mb-4">
            <AriaButton 
              slot="previous"
              className="p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ChevronLeft className="h-4 w-4" />
            </AriaButton>
            <Heading className="text-base font-semibold" />
            <AriaButton 
              slot="next"
              className="p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ChevronRight className="h-4 w-4" />
            </AriaButton>
          </header>
          
        <CalendarGrid className="w-full [&_td]:p-0">
            <CalendarGridHeader>
              {(day) => (
                <CalendarHeaderCell className="text-muted-foreground text-sm font-normal h-10 text-center">
                  {day}
                </CalendarHeaderCell>
              )}
            </CalendarGridHeader>
            <CalendarGridBody>
              {(date) => (
                <CalendarCell
                  date={date}
                  className={({ isSelected, isSelectionStart, isSelectionEnd, isDisabled, isFocusVisible, isOutsideMonth }) => cn(
                    "w-full h-10 flex items-center justify-center text-sm cursor-pointer transition-colors outline-none",
                    // Hoje - apenas negrito, sem fundo
                    date.compare(today(getLocalTimeZone())) === 0 && !isSelected && "font-bold",
                    // Fora do mês
                    isOutsideMonth && "text-muted-foreground/50",
                    // Desabilitado
                    isDisabled && "text-muted-foreground/30 cursor-not-allowed",
                    // Meio do range - faixa contínua SEM arredondamento
                    isSelected && !isSelectionStart && !isSelectionEnd && "bg-primary/20 text-foreground",
                    // Início do range - arredondado apenas à esquerda
                    isSelectionStart && !isSelectionEnd && "bg-primary text-primary-foreground font-medium rounded-l-lg",
                    // Fim do range - arredondado apenas à direita
                    isSelectionEnd && !isSelectionStart && "bg-primary text-primary-foreground font-medium rounded-r-lg",
                    // Início e fim no mesmo dia - totalmente arredondado
                    isSelectionStart && isSelectionEnd && "bg-primary text-primary-foreground font-medium rounded-lg",
                    // Hover (quando não selecionado)
                    !isSelected && !isDisabled && "hover:bg-muted rounded-lg",
                    // Focus
                    isFocusVisible && "ring-2 ring-ring ring-offset-2 rounded-lg"
                  )}
                />
              )}
            </CalendarGridBody>
          </CalendarGrid>
        </RangeCalendar>

        {/* Resumo do período */}
        {range && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
            <span className="text-sm font-medium">
              {formatDate(range.start)}
              {" → "}
              {formatDate(range.end)}
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            className="flex-1" 
            disabled={!range}
            onClick={handleApply}
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
