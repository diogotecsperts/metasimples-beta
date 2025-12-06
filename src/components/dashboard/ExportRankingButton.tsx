import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Monitor, Smartphone, Loader2 } from "lucide-react";
import { ExportableRanking } from "./ExportableRanking";
import { toast } from "sonner";

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
};

type ExportRankingButtonProps = {
  ranking: RankingItem[];
  dataFormatada: string;
  metaTotal: number;
  vendasTotal: number;
  atingimentoGeral: number;
  rankingContainerRef?: React.RefObject<HTMLDivElement>;
};

export function ExportRankingButton({
  ranking,
  dataFormatada,
  metaTotal,
  vendasTotal,
  atingimentoGeral,
  rankingContainerRef,
}: ExportRankingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"desktop" | "mobile" | null>(null);
  const compactRef = useRef<HTMLDivElement>(null);

  const handleExportDesktop = async () => {
    if (!rankingContainerRef?.current) {
      toast.error("Container de ranking não encontrado");
      return;
    }

    setExportType("desktop");
    setIsExporting(true);

    try {
      // Adiciona padding temporário ao container para melhor captura
      const container = rankingContainerRef.current;
      const originalPadding = container.style.padding;
      const originalBackground = container.style.background;
      const originalOverflow = container.style.overflow;
      
      container.style.padding = "40px 24px 24px 24px";
      container.style.background = "#ffffff";
      container.style.overflow = "visible";

      // Aguarda um frame para aplicar os estilos
      await new Promise((resolve) => setTimeout(resolve, 50));

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
      });

      // Restaura os estilos originais
      container.style.padding = originalPadding;
      container.style.background = originalBackground;
      container.style.overflow = originalOverflow;

      const link = document.createElement("a");
      link.download = `ranking-desktop-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Imagem exportada com sucesso!");
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar imagem");
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportMobile = async () => {
    if (!compactRef.current) {
      toast.error("Container compacto não encontrado");
      return;
    }

    setExportType("mobile");
    setIsExporting(true);

    try {
      // Aguarda um frame para garantir que o elemento está renderizado
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(compactRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `ranking-compacto-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Imagem exportada com sucesso!");
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar imagem");
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const lojasComMeta = ranking.filter((r) => r.metaDiaria > 0);

  if (lojasComMeta.length === 0) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Ranking como Imagem</DialogTitle>
            <DialogDescription>
              Escolha o formato de exportação para salvar o ranking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={handleExportDesktop}
              disabled={isExporting || !rankingContainerRef}
            >
              {isExporting && exportType === "desktop" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Monitor className="h-6 w-6" />
              )}
              <div className="text-center">
                <p className="font-medium">Desktop</p>
                <p className="text-xs text-muted-foreground">
                  Captura da tela atual
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={handleExportMobile}
              disabled={isExporting}
            >
              {isExporting && exportType === "mobile" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
              <div className="text-center">
                <p className="font-medium">Mobile Compacto</p>
                <p className="text-xs text-muted-foreground">
                  Otimizado para WhatsApp
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Container invisível para renderização do layout compacto */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <ExportableRanking
          ref={compactRef}
          ranking={ranking}
          dataFormatada={dataFormatada}
          metaTotal={metaTotal}
          vendasTotal={vendasTotal}
          atingimentoGeral={atingimentoGeral}
        />
      </div>
    </>
  );
}
