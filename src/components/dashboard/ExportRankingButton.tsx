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
import { ExportableRankingDesktop } from "./ExportableRankingDesktop";
import { toast } from "sonner";

type RankingItem = {
  lojaId: string;
  nomeLoja: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
  tendencia?: number | null;
  isEmAlerta?: boolean;
  ultimaAtualizacao?: string;
  ultimoHorario?: string | null;
};

type ExportRankingButtonProps = {
  ranking: RankingItem[];
  dataFormatada: string;
  metaTotal: number;
  vendasTotal: number;
  atingimentoGeral: number;
  rankingContainerRef?: React.RefObject<HTMLDivElement>;
  isMensal?: boolean;
};

export function ExportRankingButton({
  ranking,
  dataFormatada,
  metaTotal,
  vendasTotal,
  atingimentoGeral,
  isMensal = false,
}: ExportRankingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"desktop" | "admin" | "gerente" | null>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const simpleRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const handleExportDesktop = async () => {
    if (!desktopRef.current) {
      toast.error("Container desktop não encontrado");
      return;
    }

    setExportType("desktop");
    setIsExporting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(desktopRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (_clonedDoc, element) => {
          element.style.visibility = "visible";
          element.style.position = "absolute";
          element.style.left = "0";
          element.style.top = "0";
          const parent = element.parentElement;
          if (parent) {
            parent.style.visibility = "visible";
            parent.style.position = "absolute";
            parent.style.left = "0";
            parent.style.top = "0";
            parent.style.overflow = "visible";
          }
        },
      });

      const link = document.createElement("a");
      const prefix = isMensal ? "ranking-mensal-desktop" : "ranking-desktop";
      link.download = `${prefix}-${new Date().toISOString().split("T")[0]}.png`;
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(compactRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (_clonedDoc, element) => {
          element.style.visibility = "visible";
          element.style.position = "absolute";
          element.style.left = "0";
          element.style.top = "0";
          const parent = element.parentElement;
          if (parent) {
            parent.style.visibility = "visible";
            parent.style.position = "absolute";
            parent.style.left = "0";
            parent.style.top = "0";
            parent.style.overflow = "visible";
          }
        },
      });

      const link = document.createElement("a");
      const prefix = isMensal ? "ranking-mensal-admin" : "ranking-admin";
      link.download = `${prefix}-${new Date().toISOString().split("T")[0]}.png`;
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(simpleRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (_clonedDoc, element) => {
          element.style.visibility = "visible";
          element.style.position = "absolute";
          element.style.left = "0";
          element.style.top = "0";
          const parent = element.parentElement;
          if (parent) {
            parent.style.visibility = "visible";
            parent.style.position = "absolute";
            parent.style.left = "0";
            parent.style.top = "0";
            parent.style.overflow = "visible";
          }
        },
      });

      const link = document.createElement("a");
      const prefix = isMensal ? "ranking-mensal-gerente" : "ranking-gerente";
      link.download = `${prefix}-${new Date().toISOString().split("T")[0]}.png`;
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
              disabled={isExporting}
            >
              {isExporting && exportType === "desktop" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Monitor className="h-6 w-6" />
              )}
              <div className="text-center">
                <p className="font-medium">Desktop</p>
                <p className="text-xs text-muted-foreground">
                  Layout completo otimizado
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
          position: "fixed",
          left: "-9999px",
          top: "-9999px",
          visibility: "hidden",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <ExportableRanking
          ref={compactRef}
          ranking={ranking}
          dataFormatada={dataFormatada}
          metaTotal={metaTotal}
          vendasTotal={vendasTotal}
          atingimentoGeral={atingimentoGeral}
          isMensal={isMensal}
        />
      </div>

      {/* Container invisível para renderização do layout Gerente Compacto */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: "-9999px",
          visibility: "hidden",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <ExportableRankingSimple
          ref={simpleRef}
          ranking={ranking}
          dataFormatada={dataFormatada}
          isMensal={isMensal}
        />
      </div>

      {/* Container invisível para renderização do layout Desktop */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: "-9999px",
          visibility: "hidden",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <ExportableRankingDesktop
          ref={desktopRef}
          ranking={ranking}
          dataFormatada={dataFormatada}
          metaTotal={metaTotal}
          vendasTotal={vendasTotal}
          atingimentoGeral={atingimentoGeral}
          isMensal={isMensal}
        />
      </div>
    </>
  );
}
