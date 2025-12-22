import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Loja {
  id: string;
  nome: string;
  tipo_operacional: string;
  possui_fechamento_tardio: boolean;
}

interface Meta {
  id: string;
  loja_id: string;
  meta_mensal: number;
  meta_diaria_calculada: number;
}

interface AjusteDiario {
  meta_mensal_id: string;
  loja_id: string;
  data: string;
  meta_ajustada: number;
}

interface Lancamento {
  loja_id: string;
  valor_acumulado: number;
  horario: string;
}

interface LojaRanking {
  nome: string;
  metaDiaria: number;
  totalVendido: number;
  percentual: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getColorEmoji(percentual: number): string {
  if (percentual >= 100) return '🟢';
  if (percentual >= 80) return '🟡';
  return '🔴';
}

function getColorHex(percentual: number): string {
  if (percentual >= 100) return '#22c55e';
  if (percentual >= 80) return '#eab308';
  return '#ef4444';
}

// Calcula a meta diária considerando ajustes manuais
function calcularMetaDiariaAjustada(
  loja: Loja,
  meta: Meta | undefined,
  ajustes: AjusteDiario[],
  dataHoje: string
): number {
  if (!meta) return 0;

  // Verificar se existe ajuste para este dia específico
  const ajusteHoje = ajustes.find(
    a => a.meta_mensal_id === meta.id && a.data === dataHoje
  );

  if (ajusteHoje) {
    return ajusteHoje.meta_ajustada;
  }

  // Se não há ajuste para hoje, precisa recalcular considerando redistribuição
  const ajustesDaMeta = ajustes.filter(a => a.meta_mensal_id === meta.id);
  
  if (ajustesDaMeta.length === 0) {
    // Sem ajustes, usa meta base
    return meta.meta_diaria_calculada;
  }

  // Calcular redistribuição
  const diasNoMes = new Date(
    parseInt(dataHoje.split('-')[0]),
    parseInt(dataHoje.split('-')[1]),
    0
  ).getDate();

  // Contar dias operacionais (exclui domingos para tipo B)
  let diasOperacionais = diasNoMes;
  if (loja.tipo_operacional === 'B') {
    const ano = parseInt(dataHoje.split('-')[0]);
    const mes = parseInt(dataHoje.split('-')[1]) - 1;
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const date = new Date(ano, mes, dia);
      if (date.getDay() === 0) diasOperacionais--;
    }
  }

  const metaBase = meta.meta_mensal / diasOperacionais;
  
  // Calcular diferença total dos ajustes
  let diferencaTotal = 0;
  ajustesDaMeta.forEach(ajuste => {
    diferencaTotal += (metaBase - ajuste.meta_ajustada);
  });

  // Dias elegíveis = dias operacionais - dias com ajuste
  const diasElegiveis = diasOperacionais - ajustesDaMeta.length;
  
  if (diasElegiveis <= 0) return metaBase;

  // Meta redistribuída
  return metaBase + (diferencaTotal / diasElegiveis);
}

function generateEmailHTML(
  data: string,
  horario: string,
  ranking: LojaRanking[],
  metaTotal: number,
  vendasTotal: number,
  percentualGeral: number
): string {
  const alertas = ranking.filter(l => l.percentual < 70 && l.metaDiaria > 0);
  
  const rankingRows = ranking
    .sort((a, b) => b.percentual - a.percentual)
    .map((loja, index) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: center; font-weight: 600;">${index + 1}</td>
        <td style="padding: 12px;">${loja.nome}</td>
        <td style="padding: 12px; text-align: right;">${loja.metaDiaria > 0 ? formatCurrency(loja.metaDiaria) : '—'}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(loja.totalVendido)}</td>
        <td style="padding: 12px; text-align: center;">
          <span style="color: ${getColorHex(loja.percentual)}; font-weight: 700;">
            ${loja.metaDiaria > 0 ? `${loja.percentual.toFixed(1)}%` : '—'}
          </span>
        </td>
      </tr>
    `).join('');

  const alertasSection = alertas.length > 0 ? `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 24px;">
      <h3 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">⚠️ Alertas (abaixo de 70%)</h3>
      <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
        ${alertas.map(l => `<li style="margin-bottom: 4px;">${l.nome} - ${l.percentual.toFixed(1)}%</li>`).join('')}
      </ul>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📊 Relatório Meta Simples</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">${data} às ${horario}</p>
        </div>
        
        <!-- Resumo Geral -->
        <div style="padding: 24px;">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #374151;">📈 Resumo Geral</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0 8px;">
            <tr>
              <td style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: #6b7280;">Meta do Dia</td>
                    <td style="text-align: right; font-weight: 600; font-size: 18px;">${formatCurrency(metaTotal)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: #6b7280;">Total Vendido</td>
                    <td style="text-align: right; font-weight: 600; font-size: 18px;">${formatCurrency(vendasTotal)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: #6b7280;">Atingimento</td>
                    <td style="text-align: right; font-weight: 700; font-size: 20px; color: ${getColorHex(percentualGeral)};">
                      ${getColorEmoji(percentualGeral)} ${percentualGeral.toFixed(1)}%
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
        
        <!-- Ranking -->
        <div style="padding: 0 24px 24px;">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #374151;">🏆 Ranking de Lojas</h2>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">#</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Loja</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280;">Meta</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280;">Vendido</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600; color: #6b7280;">Ating.</th>
                </tr>
              </thead>
              <tbody>
                ${rankingRows}
              </tbody>
            </table>
          </div>
          ${alertasSection}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            Sistema Meta Simples | metasimplesrelatorios.tecsperts.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { horario: horarioParam, isTest = false, isManual = false } = await req.json();
    
    // Get current time in Brazil timezone for test reports
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Use current time for test, otherwise use the scheduled time
    const horario = isTest ? `${horaAtual} (Teste)` : horarioParam;
    
    console.log(`[send-report] Iniciando para horário: ${horario}, teste: ${isTest}, manual: ${isManual}`);

    // Fetch report settings
    const { data: settings, error: settingsError } = await supabase
      .from("report_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[send-report] Erro ao buscar configurações:", settingsError);
      throw new Error("Erro ao buscar configurações de relatório");
    }

    if (!settings) {
      console.log("[send-report] Nenhuma configuração encontrada");
      return new Response(
        JSON.stringify({ success: false, message: "Configurações não encontradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if reports are active and horario is enabled (skip check if test)
    if (!isTest) {
      // VERIFICAÇÃO DE MODO: Se é chamada automática (não manual) mas o modo é manual, bloquear
      if (!isManual && settings.modo === 'manual') {
        console.log("[send-report] Modo manual ativo, ignorando chamada de cron automático");
        return new Response(
          JSON.stringify({ success: false, message: "Modo manual ativo - chamadas automáticas bloqueadas" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // VERIFICAÇÃO DE MODO: Se é chamada manual mas o modo é automático, bloquear
      if (isManual && settings.modo !== 'manual') {
        console.log("[send-report] Modo automático ativo, ignorando chamada de cron manual");
        return new Response(
          JSON.stringify({ success: false, message: "Modo automático ativo - chamadas manuais bloqueadas" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!settings.ativo) {
        console.log("[send-report] Relatórios desativados");
        return new Response(
          JSON.stringify({ success: false, message: "Relatórios desativados" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Só verificar horarios_ativos se for chamada automática (não manual)
      if (!isManual && !settings.horarios_ativos.includes(horarioParam)) {
        console.log(`[send-report] Horário ${horarioParam} não está ativo`);
        return new Response(
          JSON.stringify({ success: false, message: "Horário não ativo" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!settings.emails || settings.emails.length === 0) {
      console.log("[send-report] Nenhum email configurado");
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum email configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get today's date in Brazil timezone
    const today = new Date();
    const brasilOffset = -3 * 60;
    const localOffset = today.getTimezoneOffset();
    const brasilTime = new Date(today.getTime() + (localOffset + brasilOffset) * 60000);
    const todayStr = brasilTime.toISOString().split('T')[0];
    const currentMonth = brasilTime.getMonth() + 1;
    const currentYear = brasilTime.getFullYear();

    // Verificar se hoje é domingo (0 = domingo)
    const isDomingo = brasilTime.getDay() === 0;
    console.log(`[send-report] Data: ${todayStr}, Mês: ${currentMonth}, Ano: ${currentYear}, Dia da semana: ${brasilTime.getDay()}, isDomingo: ${isDomingo}`);

    // Fetch all lojas
    const { data: lojas, error: lojasError } = await supabase
      .from("lojas")
      .select("*");

    if (lojasError) {
      console.error("[send-report] Erro ao buscar lojas:", lojasError);
      throw new Error("Erro ao buscar lojas");
    }

    // Filtrar lojas ativas no dia (excluir Tipo B aos domingos - não operam)
    const lojasAtivas = (lojas || []).filter((loja: Loja) => {
      if (isDomingo && loja.tipo_operacional === "B") {
        return false;
      }
      return true;
    });

    console.log(`[send-report] ${lojas?.length || 0} lojas totais, ${lojasAtivas.length} lojas ativas no dia (${isDomingo ? 'domingo' : 'dia útil'})`);

    // Fetch metas for current month
    const { data: metas, error: metasError } = await supabase
      .from("metas_mensais")
      .select("id, loja_id, meta_mensal, meta_diaria_calculada")
      .eq("mes", currentMonth)
      .eq("ano", currentYear);

    if (metasError) {
      console.error("[send-report] Erro ao buscar metas:", metasError);
      throw new Error("Erro ao buscar metas");
    }

    console.log(`[send-report] ${metas?.length || 0} metas encontradas`);

    // Fetch ajustes manuais para hoje
    const metaIds = (metas || []).map(m => m.id);
    let ajustes: AjusteDiario[] = [];
    
    if (metaIds.length > 0) {
      const { data: ajustesData, error: ajustesError } = await supabase
        .from("metas_diarias_ajustes")
        .select("meta_mensal_id, loja_id, data, meta_ajustada")
        .in("meta_mensal_id", metaIds);

      if (ajustesError) {
        console.error("[send-report] Erro ao buscar ajustes:", ajustesError);
      } else {
        ajustes = ajustesData || [];
        console.log(`[send-report] ${ajustes.length} ajustes encontrados`);
      }
    }

    // Fetch today's lancamentos
    const { data: lancamentos, error: lancamentosError } = await supabase
      .from("lancamentos_diarios")
      .select("*")
      .eq("data", todayStr);

    if (lancamentosError) {
      console.error("[send-report] Erro ao buscar lançamentos:", lancamentosError);
      throw new Error("Erro ao buscar lançamentos");
    }

    console.log(`[send-report] ${lancamentos?.length || 0} lançamentos encontrados`);

    // Build ranking data com ajustes
    const metasMap = new Map<string, Meta>();
    (metas || []).forEach((m: Meta) => {
      metasMap.set(m.loja_id, m);
    });

    const lancamentosMap = new Map<string, number>();
    (lancamentos || []).forEach((l: Lancamento) => {
      const current = lancamentosMap.get(l.loja_id) || 0;
      if (l.valor_acumulado > current) {
        lancamentosMap.set(l.loja_id, l.valor_acumulado);
      }
    });

    // Usar apenas lojas ativas no dia para o ranking
    const ranking: LojaRanking[] = lojasAtivas.map((loja: Loja) => {
      const meta = metasMap.get(loja.id);
      const metaDiaria = calcularMetaDiariaAjustada(loja, meta, ajustes, todayStr);
      const totalVendido = lancamentosMap.get(loja.id) || 0;
      const percentual = metaDiaria > 0 ? (totalVendido / metaDiaria) * 100 : 0;

      return {
        nome: loja.nome,
        metaDiaria,
        totalVendido,
        percentual,
      };
    });

    // Calculate totals
    const metaTotal = ranking.reduce((sum, l) => sum + l.metaDiaria, 0);
    const vendasTotal = ranking.reduce((sum, l) => sum + l.totalVendido, 0);
    const percentualGeral = metaTotal > 0 ? (vendasTotal / metaTotal) * 100 : 0;

    // Format date
    const dataFormatada = brasilTime.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Generate HTML
    const html = generateEmailHTML(
      dataFormatada,
      horario,
      ranking,
      metaTotal,
      vendasTotal,
      percentualGeral
    );

    // Send email
    console.log(`[send-report] Enviando email para: ${settings.emails.join(', ')}`);
    
    const emailResponse = await resend.emails.send({
      from: "Meta Simples <relatorios@metasimplesrelatorios.tecsperts.com>",
      to: settings.emails,
      subject: `📊 Relatório ${horario} - ${brasilTime.toLocaleDateString('pt-BR')} - ${percentualGeral.toFixed(0)}% atingido`,
      html,
    });

    console.log("[send-report] Email enviado:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Relatório enviado com sucesso", emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-report] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
