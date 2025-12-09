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
import { Download, Monitor, Smartphone, Users, Loader2 } from "lucide-react";
import { ExportableRanking } from "./ExportableRanking";
import { ExportableRankingSimple } from "./ExportableRankingSimple";
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
  const [exportType, setExportType] = useState<"desktop" | "admin" | "gerente" | null>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const simpleRef = useRef<HTMLDivElement>(null);

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
      
      container.style.padding = "48px 24px 24px 24px";
      container.style.background = "#ffffff";
      container.style.overflow = "visible";

      // Esconde temporariamente os badges de alerta para a exportação
      const alertBadges = container.querySelectorAll('[data-alert-badge]');
      alertBadges.forEach((badge) => {
        (badge as HTMLElement).style.display = 'none';
      });

      // Aguarda um frame para aplicar os estilos
      await new Promise((resolve) => setTimeout(resolve, 50));

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        x: -16,
        y: -16,
        width: container.offsetWidth + 32,
        height: container.offsetHeight + 32,
      });

      // Restaura os estilos originais
      container.style.padding = originalPadding;
      container.style.background = originalBackground;
      container.style.overflow = originalOverflow;

      // Restaura a visibilidade dos badges de alerta
      alertBadges.forEach((badge) => {
        (badge as HTMLElement).style.display = '';
      });

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

  const handleExportAdmin = async () => {
    if (!compactRef.current) {
      toast.error("Container compacto não encontrado");
      return;
    }

    setExportType("admin");
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
      link.download = `ranking-admin-${new Date().toISOString().split("T")[0]}.png`;
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

  const handleExportGerente = async () => {
    if (!simpleRef.current) {
      toast.error("Container simples não encontrado");
      return;
    }

    setExportType("gerente");
    setIsExporting(true);

    try {
      // Aguarda um frame para garantir que o elemento está renderizado
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(simpleRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `ranking-gerente-${new Date().toISOString().split("T")[0]}.png`;
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
              onClick={handleExportAdmin}
              disabled={isExporting}
            >
              {isExporting && exportType === "admin" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
              <div className="text-center">
                <p className="font-medium">Admin Compacto</p>
                <p className="text-xs text-muted-foreground">
                  Com Meta e Vendido por loja
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={handleExportGerente}
              disabled={isExporting}
            >
              {isExporting && exportType === "gerente" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Users className="h-6 w-6" />
              )}
              <div className="text-center">
                <p className="font-medium">Gerente Compacto</p>
                <p className="text-xs text-muted-foreground">
                  Apenas posição, nome e percentual
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Container invisível para renderização do layout Admin Compacto */}
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

      {/* Container invisível para renderização do layout Gerente Compacto */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <ExportableRankingSimple
          ref={simpleRef}
          ranking={ranking}
          dataFormatada={dataFormatada}
        />
      </div>
    </>
  );
}
