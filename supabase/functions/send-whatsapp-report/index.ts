import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  loja_id: string;
  meta_diaria_calculada: number;
}

interface Lancamento {
  loja_id: string;
  valor_acumulado: number;
}

interface Gerente {
  id: string;
  nome: string;
  telefone: string;
  loja_id: string;
}

interface LojaRanking {
  nome: string;
  metaDiaria: number;
  totalVendido: number;
  percentual: number;
}

interface SendPulseContact {
  id: string;
  status: number;
  phone: string;
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

function normalizePhoneNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Se já começa com 55, adiciona apenas o +
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  
  // Adiciona +55 no início
  return `+55${digits}`;
}

// Gera array de 14 parâmetros para o template relatorio_diario_v2
function generateTemplateParameters(
  data: string,
  horario: string,
  ranking: LojaRanking[],
  metaTotal: number,
  vendasTotal: number,
  percentualGeral: number
): string[] {
  const sortedRanking = [...ranking].sort((a, b) => b.percentual - a.percentual);
  
  // {{1}}: Data e horário
  const param1 = `${data} - ${horario}`;
  
  // {{2}}: Atingimento geral
  const param2 = `${percentualGeral.toFixed(0)}%`;
  
  // {{3}}: Meta do dia
  const param3 = formatCurrency(metaTotal);
  
  // {{4}}: Total vendido
  const param4 = formatCurrency(vendasTotal);
  
  // {{5}} a {{14}}: Ranking das 10 lojas
  const rankingParams: string[] = [];
  for (let i = 0; i < 10; i++) {
    if (i < sortedRanking.length) {
      const loja = sortedRanking[i];
      const emoji = getColorEmoji(loja.percentual);
      const percentualStr = loja.metaDiaria > 0 ? `${loja.percentual.toFixed(0)}%` : '—';
      rankingParams.push(`${emoji} ${loja.nome} - ${percentualStr}`);
    } else {
      // Se houver menos de 10 lojas, usar placeholder
      rankingParams.push('—');
    }
  }
  
  return [param1, param2, param3, param4, ...rankingParams];
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("[send-whatsapp-report] Obtendo access token do SendPulse...");
  
  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[send-whatsapp-report] Erro ao obter token:", response.status, errorText);
    throw new Error(`Erro ao obter token SendPulse: ${response.status}`);
  }

  const data = await response.json();
  console.log("[send-whatsapp-report] Token obtido com sucesso");
  return data.access_token;
}

// Busca contato pelo telefone no SendPulse
async function getContactByPhone(
  accessToken: string,
  botId: string,
  phone: string
): Promise<SendPulseContact | null> {
  console.log(`[send-whatsapp-report] Buscando contato pelo telefone ${phone}...`);
  
  const url = `https://api.sendpulse.com/whatsapp/contacts/getByPhone?bot_id=${botId}&phone=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-report] Resposta getContactByPhone:`, response.status, responseText);

  if (!response.ok) {
    console.log(`[send-whatsapp-report] Contato não encontrado para ${phone}`);
    return null;
  }

  try {
    const data = JSON.parse(responseText);
    if (data.success && data.data) {
      console.log(`[send-whatsapp-report] Contato encontrado: id=${data.data.id}, status=${data.data.status}`);
      return {
        id: data.data.id,
        status: data.data.status,
        phone: data.data.phone || phone
      };
    }
  } catch (e) {
    console.error(`[send-whatsapp-report] Erro ao parsear resposta:`, e);
  }

  return null;
}

// Habilita (desbanir) um contato no SendPulse
async function enableContact(
  accessToken: string,
  contactId: string
): Promise<boolean> {
  console.log(`[send-whatsapp-report] Tentando habilitar contato ${contactId}...`);
  
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/enable", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contact_id: contactId }),
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-report] Resposta enableContact:`, response.status, responseText);

  return response.ok;
}

// Envia template usando contact_id (em vez de phone)
async function sendWhatsAppTemplateByContactId(
  accessToken: string,
  contactId: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string }> {
  console.log(`[send-whatsapp-report] Enviando template ${templateName} para contact_id ${contactId}...`);
  
  // Converter array em formato de parâmetros do SendPulse
  const bodyParameters = parameters.map(text => ({ type: "text", text }));
  
  const requestBody = {
    contact_id: contactId,
    template: {
      name: templateName,
      language: { 
        policy: "deterministic", 
        code: "pt_BR" 
      },
      components: [
        {
          type: "body",
          parameters: bodyParameters
        }
      ]
    }
  };

  // Log detalhado do body para debug
  console.log(`[send-whatsapp-report] Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/sendTemplate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-report] Resposta sendTemplate:`, response.status, responseText);

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}: ${responseText}` };
  }

  // Parse response to check for success field
  try {
    const responseJson = JSON.parse(responseText);
    if (responseJson.success === false) {
      return { success: false, error: responseJson.message || JSON.stringify(responseJson.errors) || "SendPulse returned success: false" };
    }
  } catch (e) {
    // Response wasn't JSON, continue
  }

  return { success: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendpulseClientId = Deno.env.get("SENDPULSE_CLIENT_ID");
    const sendpulseClientSecret = Deno.env.get("SENDPULSE_CLIENT_SECRET");
    const sendpulseBotId = Deno.env.get("SENDPULSE_BOT_ID");

    if (!sendpulseClientId || !sendpulseClientSecret || !sendpulseBotId) {
      console.error("[send-whatsapp-report] Secrets do SendPulse não configurados");
      return new Response(
        JSON.stringify({ success: false, error: "Secrets do SendPulse não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp-report] Bot ID: ${sendpulseBotId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { horario: horarioParam, isTest = false } = await req.json();
    
    // Get current time in Brazil timezone
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const horario = isTest ? `${horaAtual} (Teste)` : horarioParam;
    
    console.log(`[send-whatsapp-report] Iniciando para horário: ${horario}, teste: ${isTest}`);

    // Fetch WhatsApp report settings
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_report_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[send-whatsapp-report] Erro ao buscar configurações:", settingsError);
      throw new Error("Erro ao buscar configurações de WhatsApp");
    }

    if (!settings) {
      console.log("[send-whatsapp-report] Nenhuma configuração encontrada");
      return new Response(
        JSON.stringify({ success: false, message: "Configurações não encontradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if reports are active (skip check if test)
    if (!isTest && !settings.ativo) {
      console.log("[send-whatsapp-report] Relatórios WhatsApp desativados");
      return new Response(
        JSON.stringify({ success: false, message: "Relatórios WhatsApp desativados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if horario is enabled (skip check if test)
    if (!isTest && !settings.horarios_ativos.includes(horarioParam)) {
      console.log(`[send-whatsapp-report] Horário ${horarioParam} não está ativo`);
      return new Response(
        JSON.stringify({ success: false, message: "Horário não ativo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.gerentes_ativos || settings.gerentes_ativos.length === 0) {
      console.log("[send-whatsapp-report] Nenhum gerente configurado");
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum gerente configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active gerentes with their phone numbers
    const { data: gerentes, error: gerentesError } = await supabase
      .from("profiles")
      .select("id, nome, telefone, loja_id")
      .in("id", settings.gerentes_ativos);

    if (gerentesError) {
      console.error("[send-whatsapp-report] Erro ao buscar gerentes:", gerentesError);
      throw new Error("Erro ao buscar gerentes");
    }

    // Filter gerentes with valid phone numbers
    const gerentesComTelefone = (gerentes || []).filter(g => g.telefone && g.telefone.trim() !== '');
    
    if (gerentesComTelefone.length === 0) {
      console.log("[send-whatsapp-report] Nenhum gerente com telefone válido");
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum gerente com telefone válido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp-report] ${gerentesComTelefone.length} gerentes com telefone encontrados`);

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
    console.log(`[send-whatsapp-report] Data: ${todayStr}, Mês: ${currentMonth}, Ano: ${currentYear}, Dia da semana: ${brasilTime.getDay()}, isDomingo: ${isDomingo}`);

    // Fetch all lojas
    const { data: lojas, error: lojasError } = await supabase
      .from("lojas")
      .select("*");

    if (lojasError) {
      console.error("[send-whatsapp-report] Erro ao buscar lojas:", lojasError);
      throw new Error("Erro ao buscar lojas");
    }

    // Filtrar lojas ativas no dia (excluir Tipo B aos domingos - não operam)
    const lojasAtivas = (lojas || []).filter((loja: Loja) => {
      if (isDomingo && loja.tipo_operacional === "B") {
        return false;
      }
      return true;
    });

    console.log(`[send-whatsapp-report] ${lojas?.length || 0} lojas totais, ${lojasAtivas.length} lojas ativas no dia (${isDomingo ? 'domingo' : 'dia útil'})`);

    // Fetch metas for current month
    const { data: metas, error: metasError } = await supabase
      .from("metas_mensais")
      .select("*")
      .eq("mes", currentMonth)
      .eq("ano", currentYear);

    if (metasError) {
      console.error("[send-whatsapp-report] Erro ao buscar metas:", metasError);
      throw new Error("Erro ao buscar metas");
    }

    console.log(`[send-whatsapp-report] ${metas?.length || 0} metas encontradas`);

    // Fetch today's lancamentos
    const { data: lancamentos, error: lancamentosError } = await supabase
      .from("lancamentos_diarios")
      .select("*")
      .eq("data", todayStr);

    if (lancamentosError) {
      console.error("[send-whatsapp-report] Erro ao buscar lançamentos:", lancamentosError);
      throw new Error("Erro ao buscar lançamentos");
    }

    console.log(`[send-whatsapp-report] ${lancamentos?.length || 0} lançamentos encontrados`);

    // Build ranking data
    const metasMap = new Map<string, number>();
    (metas || []).forEach((m: Meta) => {
      metasMap.set(m.loja_id, m.meta_diaria_calculada);
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
      const metaDiaria = metasMap.get(loja.id) || 0;
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Gerar os 14 parâmetros para o template
    const templateParams = generateTemplateParameters(
      dataFormatada,
      horario,
      ranking,
      metaTotal,
      vendasTotal,
      percentualGeral
    );

    console.log("[send-whatsapp-report] Parâmetros gerados:", templateParams);

    // Get SendPulse access token
    const accessToken = await getAccessToken(sendpulseClientId, sendpulseClientSecret);

    // Mapeamento fixo de telefone -> contact_id (contatos ativos no SendPulse)
    // Isso evita a busca por telefone que pode encontrar contatos banidos
    const phoneToContactId: Record<string, string> = {
      "+5582981627838": "69322fead2b7eee6000b2336"  // Diogo - Proprietário (ativo)
    };

    // Send to each gerente
    const results: { gerente: string; success: boolean; error?: string }[] = [];
    
    for (const gerente of gerentesComTelefone) {
      const normalizedPhone = normalizePhoneNumber(gerente.telefone);
      console.log(`[send-whatsapp-report] Processando ${gerente.nome} (${normalizedPhone})...`);
      
      // Usar contact_id mapeado diretamente
      const contactId = phoneToContactId[normalizedPhone];
      
      if (!contactId) {
        console.log(`[send-whatsapp-report] Contact ID não mapeado para ${gerente.nome} (${normalizedPhone})`);
        results.push({
          gerente: gerente.nome,
          success: false,
          error: `Contact ID não configurado para ${normalizedPhone}. Adicione o mapeamento no código.`
        });
        continue;
      }
      
      console.log(`[send-whatsapp-report] Enviando para ${gerente.nome} usando contact_id fixo: ${contactId}`);
      
      const result = await sendWhatsAppTemplateByContactId(
        accessToken,
        contactId,
        "relatorio_diario_v2",
        templateParams
      );
      
      results.push({
        gerente: gerente.nome,
        success: result.success,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[send-whatsapp-report] Concluído: ${successCount} sucesso, ${failCount} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Enviado para ${successCount} gerente(s)`,
        results,
        successCount,
        failCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-whatsapp-report] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
