import { forwardRef } from "react";
import { Clock } from "lucide-react";

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

type ExportableRankingDesktopProps = {
  ranking: RankingItem[];
  dataFormatada: string;
  metaTotal: number;
  vendasTotal: number;
  atingimentoGeral: number;
  isMensal?: boolean;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
};

const getStatusColor = (percentual: number, temMeta: boolean) => {
  if (!temMeta) return "#9ca3af"; // gray
  if (percentual >= 100) return "#22c55e"; // green
  if (percentual >= 80) return "#eab308"; // yellow
  return "#ef4444"; // red
};

const getStatusBg = (percentual: number, temMeta: boolean) => {
  if (!temMeta) return { bg: "#f3f4f6", border: "#d1d5db" };
  if (percentual >= 100) return { bg: "#f0fdf4", border: "#86efac" };
  if (percentual >= 80) return { bg: "#fefce8", border: "#fde047" };
  return { bg: "#fef2f2", border: "#fca5a5" };
};

type RankingCardDesktopProps = {
  posicao: number;
  item: RankingItem;
  isMensal?: boolean;
};

function RankingCardDesktop({ posicao, item, isMensal = false }: RankingCardDesktopProps) {
  const temMeta = item.metaDiaria > 0;
  const statusColor = getStatusColor(item.percentualAtingimento, temMeta);
  const statusBg = getStatusBg(item.percentualAtingimento, temMeta);
  const percentualFormatado = temMeta ? `${item.percentualAtingimento.toFixed(1)}%` : "—";

  return (
    <div
      style={{
        backgroundColor: statusBg.bg,
        border: `2px solid ${statusBg.border}`,
        borderRadius: 12,
        padding: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        position: "relative",
      }}
    >
      {/* Header: Posição e Nome - SEM ÍCONE */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          marginBottom: 16,
          minHeight: 60,
        }}
      >
        {/* Posição - largura fixa */}
        <div
          style={{
            flexShrink: 0,
            width: 70,
            fontSize: 32,
            fontWeight: 700,
            color: "#9ca3af",
            lineHeight: 1.2,
          }}
        >
          #{posicao}
        </div>
        
        {/* Nome - sem overflow hidden */}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            padding: "8px 16px",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1f2937",
              display: "block",
              lineHeight: 1.6,
            }}
          >
            {item.nomeLoja}
          </span>
        </div>

        {/* Espaçador para balancear - mesma largura da posição */}
        <div
          style={{
            flexShrink: 0,
            width: 70,
          }}
        />
      </div>

      {/* Dados */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "#6b7280" }}>{isMensal ? "Meta Mensal:" : "Meta Diária:"}</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
            {temMeta ? formatCurrency(item.metaDiaria) : "—"}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "#6b7280" }}>{isMensal ? "Total do Mês:" : "Total Vendido:"}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
            {formatCurrency(item.totalVendido)}
          </span>
        </div>

        <div
          style={{
            paddingTop: 12,
            marginTop: 8,
            borderTop: "1px solid rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#1f2937" }}>Atingimento:</span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: statusColor,
              }}
            >
              {percentualFormatado}
            </span>
          </div>

          {/* Tendência */}
          {item.tendencia !== null && item.tendencia !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              {item.tendencia > 0 ? (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#22c55e" }}>
                  ▲ +{item.tendencia.toFixed(1)}% vs ontem
                </span>
              ) : item.tendencia < 0 ? (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#ef4444" }}>
                  ▼ {item.tendencia.toFixed(1)}% vs ontem
                </span>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#6b7280" }}>
                  = vs ontem
                </span>
              )}
            </div>
          )}

          {/* Última atualização */}
          {item.ultimaAtualizacao && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <Clock style={{ width: 12, height: 12, color: "#9ca3af" }} />
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                Atualizado às {formatTime(item.ultimaAtualizacao)}
                {item.ultimoHorario && ` • ${item.ultimoHorario}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ExportableRankingDesktop = forwardRef<HTMLDivElement, ExportableRankingDesktopProps>(
  ({ ranking, dataFormatada, metaTotal, vendasTotal, atingimentoGeral, isMensal = false }, ref) => {
    const lojasComMeta = ranking.filter((r) => r.metaDiaria > 0);

    const getOverallStatusColor = () => {
      if (atingimentoGeral >= 100) return "#22c55e";
      if (atingimentoGeral >= 80) return "#eab308";
      return "#ef4444";
    };

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: "#ffffff",
          padding: 32,
          minWidth: 1200,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: "#1f2937", margin: 0 }}>
            Ranking de Performance{isMensal && <span style={{color: "#3b82f6"}}> Mensal</span>}
          </h1>
          <p style={{ fontSize: 22, color: "#6b7280", margin: "16px 0 0 0" }}>
            {dataFormatada} • {lojasComMeta.length} lojas com meta
          </p>
        </div>

        {/* Grid de Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {lojasComMeta.map((item, index) => (
            <RankingCardDesktop key={item.lojaId} posicao={index + 1} item={item} isMensal={isMensal} />
          ))}
        </div>
      </div>
    );
  }
);

ExportableRankingDesktop.displayName = "ExportableRankingDesktop";
