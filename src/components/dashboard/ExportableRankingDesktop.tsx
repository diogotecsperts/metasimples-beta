import { forwardRef } from "react";
import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

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
};

function RankingCardDesktop({ posicao, item }: RankingCardDesktopProps) {
  const temMeta = item.metaDiaria > 0;
  const statusColor = getStatusColor(item.percentualAtingimento, temMeta);
  const statusBg = getStatusBg(item.percentualAtingimento, temMeta);
  const percentualFormatado = temMeta ? `${item.percentualAtingimento.toFixed(1)}%` : "—";

  const IconComponent = () => {
    if (!temMeta) return <Minus style={{ width: 40, height: 40, color: statusColor }} />;
    if (item.percentualAtingimento >= 100) return <TrendingUp style={{ width: 40, height: 40, color: statusColor }} />;
    if (item.percentualAtingimento >= 80) return <Minus style={{ width: 40, height: 40, color: statusColor }} />;
    return <TrendingDown style={{ width: 40, height: 40, color: statusColor }} />;
  };

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
      {/* Header: Posição, Nome, Ícone - todos na mesma linha */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#9ca3af",
            flexShrink: 0,
          }}
        >
          #{posicao}
        </div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#1f2937",
            textAlign: "center",
            flex: 1,
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.nomeLoja}
        </h3>
        <div style={{ flexShrink: 0 }}>
          <IconComponent />
        </div>
      </div>

      {/* Dados */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "#6b7280" }}>Meta Diária:</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
            {temMeta ? formatCurrency(item.metaDiaria) : "—"}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "#6b7280" }}>Total Vendido:</span>
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
                <>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#22c55e" }}>
                    ▲ +{item.tendencia.toFixed(1)}% vs ontem
                  </span>
                </>
              ) : item.tendencia < 0 ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#ef4444" }}>
                    ▼ {item.tendencia.toFixed(1)}% vs ontem
                  </span>
                </>
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
  ({ ranking, dataFormatada, metaTotal, vendasTotal, atingimentoGeral }, ref) => {
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
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1f2937", margin: 0 }}>
            Ranking de Performance
          </h1>
          <p style={{ fontSize: 16, color: "#6b7280", margin: "8px 0 0 0" }}>
            {dataFormatada} • {lojasComMeta.length} lojas com meta
          </p>
        </div>

        {/* Resumo Geral */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 32,
            marginBottom: 32,
            padding: 20,
            backgroundColor: "#f9fafb",
            borderRadius: 12,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Meta Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>
              {formatCurrency(metaTotal)}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Total Vendido</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>
              {formatCurrency(vendasTotal)}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Atingimento Geral</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: getOverallStatusColor() }}>
              {atingimentoGeral.toFixed(1)}%
            </div>
          </div>
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
            <RankingCardDesktop key={item.lojaId} posicao={index + 1} item={item} />
          ))}
        </div>
      </div>
    );
  }
);

ExportableRankingDesktop.displayName = "ExportableRankingDesktop";
