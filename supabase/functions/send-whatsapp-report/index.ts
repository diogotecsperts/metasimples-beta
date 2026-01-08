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
    return meta.meta_diaria_calculada;
  }

  // Calcular redistribuição
  const diasNoMes = new Date(
    parseInt(dataHoje.split('-')[0]),
    parseInt(dataHoje.split('-')[1]),
    0
  ).getDate();

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
  
  let diferencaTotal = 0;
  ajustesDaMeta.forEach(ajuste => {
    diferencaTotal += (metaBase - ajuste.meta_ajustada);
  });

  const diasElegiveis = diasOperacionais - ajustesDaMeta.length;
  
  if (diasElegiveis <= 0) return metaBase;

  return metaBase + (diferencaTotal / diasElegiveis);
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
): Promise<{ success: boolean; error?: string; messageId?: string; sendpulseStatus?: number; fullResponse?: string }> {
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

  // Sempre capturar a resposta completa
  let messageId: string | undefined;
  let sendpulseStatus: number | undefined;

  try {
    const responseJson = JSON.parse(responseText);
    // Tentar extrair message_id da resposta (pode variar dependendo da estrutura)
    messageId = responseJson.data?.message_id || responseJson.message_id || responseJson.data?.id;
    sendpulseStatus = response.status;
    
    if (!response.ok) {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${responseText}`,
        messageId,
        sendpulseStatus,
        fullResponse: responseText
      };
    }

    if (responseJson.success === false) {
      return { 
        success: false, 
        error: responseJson.message || JSON.stringify(responseJson.errors) || "SendPulse returned success: false",
        messageId,
        sendpulseStatus,
        fullResponse: responseText
      };
    }
    
    return { 
      success: true,
      messageId,
      sendpulseStatus,
      fullResponse: responseText
    };
  } catch (e) {
    // Response não era JSON válido
    if (!response.ok) {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${responseText}`,
        sendpulseStatus: response.status,
        fullResponse: responseText
      };
    }
    return { 
      success: true,
      sendpulseStatus: response.status,
      fullResponse: responseText
    };
  }
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

    const { horario: horarioParam, isTest = false, adminsParaTeste } = await req.json();
    
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
      console.log("[send-whatsapp-report] Nenhum administrador configurado");
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum administrador configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-whatsapp-report] ${settings.gerentes_ativos.length} administradores configurados`);

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
      .select("id, loja_id, meta_mensal, meta_diaria_calculada")
      .eq("mes", currentMonth)
      .eq("ano", currentYear);

    if (metasError) {
      console.error("[send-whatsapp-report] Erro ao buscar metas:", metasError);
      throw new Error("Erro ao buscar metas");
    }

    console.log(`[send-whatsapp-report] ${metas?.length || 0} metas encontradas`);

    // Fetch ajustes manuais para hoje
    const metaIds = (metas || []).map(m => m.id);
    let ajustes: AjusteDiario[] = [];
    
    if (metaIds.length > 0) {
      const { data: ajustesData, error: ajustesError } = await supabase
        .from("metas_diarias_ajustes")
        .select("meta_mensal_id, loja_id, data, meta_ajustada")
        .in("meta_mensal_id", metaIds);

      if (ajustesError) {
        console.error("[send-whatsapp-report] Erro ao buscar ajustes:", ajustesError);
      } else {
        ajustes = ajustesData || [];
        console.log(`[send-whatsapp-report] ${ajustes.length} ajustes encontrados`);
      }
    }

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

    // Mapeamento fixo de telefone -> contact_id para ADMINISTRADORES
    // Estes são os únicos que recebem relatórios
    const KNOWN_CONTACTS: Record<string, string> = {
      "+5582981627838": "69322fead2b7eee6000b2336", // Diogo DEV
      "+5587981757169": "69370bb93debac0d790a7a42", // Thiago
      "+5581982882100": "69556ee0143b1c873907e644", // Dyogo
    };

    // Lista fixa de administradores com seus dados
    const ADMIN_CONTACTS: { id: string; nome: string; telefone: string; contactId: string }[] = [
      { id: "ca936b16-8a15-43f4-976d-6be91e294099", nome: "Diogo DEV", telefone: "+5582981627838", contactId: "69322fead2b7eee6000b2336" },
      { id: "766164b8-23c5-490a-8409-412e8651da33", nome: "Thiago", telefone: "+5587981757169", contactId: "69370bb93debac0d790a7a42" },
      { id: "687d830b-4bad-4e39-9273-fab71f0d4bd0", nome: "Dyogo", telefone: "+5581982882100", contactId: "69556ee0143b1c873907e644" },
    ];

    // Filtrar admins: se for teste com lista específica, usar essa lista; senão, usar config do banco
    let adminsParaEnviar = ADMIN_CONTACTS.filter(admin => 
      settings.gerentes_ativos.includes(admin.id)
    );

    // Se for modo teste E recebeu lista específica de admins, usar essa lista
    if (isTest && adminsParaTeste && Array.isArray(adminsParaTeste) && adminsParaTeste.length > 0) {
      console.log(`[send-whatsapp-report] Modo teste com ${adminsParaTeste.length} admins específicos: ${adminsParaTeste.join(', ')}`);
      adminsParaEnviar = ADMIN_CONTACTS.filter(admin => 
        adminsParaTeste.includes(admin.id)
      );
    }

    console.log(`[send-whatsapp-report] ${adminsParaEnviar.length} administradores para receber relatório`);

    if (adminsParaEnviar.length === 0) {
      console.log("[send-whatsapp-report] Nenhum administrador selecionado");
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum administrador selecionado para receber relatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to each admin
    const results: { admin: string; success: boolean; error?: string }[] = [];
    
    for (const admin of adminsParaEnviar) {
      console.log(`[send-whatsapp-report] Processando ${admin.nome} (${admin.telefone})...`);
      
      // Tentar enviar usando contact_id diretamente
      console.log(`[send-whatsapp-report] Enviando para ${admin.nome} usando contact_id: ${admin.contactId}`);
      
      let result = await sendWhatsAppTemplateByContactId(
        accessToken,
        admin.contactId,
        "relatorio_diario_v2",
        templateParams
      );
      
      // Se falhou com erro de contato banido, tentar habilitar e reenviar
      if (!result.success && result.error?.includes("banned")) {
        console.log(`[send-whatsapp-report] Contato ${admin.nome} está banido, tentando habilitar...`);
        const enabled = await enableContact(accessToken, admin.contactId);
        
        if (enabled) {
          console.log(`[send-whatsapp-report] Contato habilitado, reenviando...`);
          result = await sendWhatsAppTemplateByContactId(
            accessToken,
            admin.contactId,
            "relatorio_diario_v2",
            templateParams
          );
        }
      }
      
      // Registrar no log de envios com rastreabilidade completa
      const logEntry = {
        admin_id: admin.id,
        admin_nome: admin.nome,
        admin_telefone: admin.telefone,
        data: todayStr,
        horario_envio: isTest ? "teste" : (horarioParam || "manual"),
        template_usado: "relatorio_diario_v2",
        is_test: isTest,
        status: result.success ? "enviado" : "falhou",
        erro_detalhes: result.error || null,
        // Colunas de rastreabilidade do SendPulse
        sendpulse_response: result.fullResponse || null,
        sendpulse_message_id: result.messageId || null,
        sendpulse_status: result.sendpulseStatus || null,
        // Status de entrega: 'aceito' pelo SendPulse, aguardando webhook para confirmar 'enviado'
        status_entrega: result.success ? "aceito" : "falhou",
        // Novo: registrar método de envio (sempre contact_id neste endpoint)
        metodo_envio: "contact_id",
        contact_id_usado: admin.contactId
      };
      
      console.log(`[send-whatsapp-report] Salvando log com rastreabilidade:`, {
        messageId: result.messageId,
        sendpulseStatus: result.sendpulseStatus,
        fullResponseLength: result.fullResponse?.length
      });
      
      const { error: logError } = await supabase
        .from("whatsapp_report_log")
        .insert(logEntry);
      
      if (logError) {
        console.error(`[send-whatsapp-report] Erro ao salvar log:`, logError);
      } else {
        console.log(`[send-whatsapp-report] Log registrado para ${admin.nome}`);
      }
      
      results.push({
        admin: admin.nome,
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
        message: `Enviado para ${successCount} administrador(es)`,
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
