import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Gerente {
  id: string;
  nome: string;
  telefone: string;
  loja_id: string;
}

interface Loja {
  id: string;
  nome: string;
}

// Templates por nível de cobrança
const TEMPLATES_POR_NIVEL: Record<number, string> = {
  1: "lembrete_meta_v1",      // Lembrete suave
  2: "lembrete_meta_urgente_v2", // Lembrete urgente
  3: "lembrete_meta_final_v1",   // Último aviso
};

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("[send-whatsapp-cobranca] Obtendo access token do SendPulse...");
  
  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[send-whatsapp-cobranca] Erro ao obter token:", response.status, errorText);
    throw new Error(`Erro ao obter token SendPulse: ${response.status}`);
  }

  const data = await response.json();
  console.log("[send-whatsapp-cobranca] Token obtido com sucesso");
  return data.access_token;
}

// NOVA FUNÇÃO: Enviar template por telefone (método principal)
async function sendWhatsAppTemplateByPhone(
  accessToken: string,
  botId: string,
  phone: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  console.log(`[send-whatsapp-cobranca] Enviando template ${templateName} para telefone ${phone}...`);
  
  const bodyParameters = parameters.map(text => ({ type: "text", text }));
  
  const requestBody = {
    bot_id: botId,
    phone: phone,
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

  console.log(`[send-whatsapp-cobranca] Request body sendTemplateByPhone:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/sendTemplateByPhone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-cobranca] Resposta sendTemplateByPhone:`, response.status, responseText);

  if (!response.ok) {
    // Tentar extrair código de erro específico
    try {
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.message || errorData.errors?.phone?.[0] || errorData.errors?.contact_id?.[0] || JSON.stringify(errorData.errors) || responseText;
      
      // Verificar se é "Contact does not exist"
      if (responseText.includes("Contact does not exist") || responseText.includes("does not exist")) {
        return { success: false, error: errorMessage, errorCode: "CONTACT_NOT_FOUND" };
      }
      
      return { success: false, error: `HTTP ${response.status}: ${errorMessage}` };
    } catch {
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }
  }

  try {
    const responseJson = JSON.parse(responseText);
    if (responseJson.success === false) {
      return { success: false, error: responseJson.message || JSON.stringify(responseJson.errors) || "SendPulse returned success: false" };
    }
  } catch {
    // Response wasn't JSON, continue
  }

  return { success: true };
}

// NOVA FUNÇÃO: Criar contato no SendPulse
async function createContact(
  accessToken: string,
  botId: string,
  phone: string,
  name: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  console.log(`[send-whatsapp-cobranca] Criando contato ${name} (${phone})...`);
  
  const requestBody = {
    bot_id: botId,
    phone: phone,
    name: name
  };

  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-cobranca] Resposta createContact:`, response.status, responseText);

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}: ${responseText}` };
  }

  try {
    const data = JSON.parse(responseText);
    if (data.success && data.data?.id) {
      return { success: true, contactId: data.data.id };
    }
    // Mesmo sem success explícito, pode ter criado
    if (data.data?.id) {
      return { success: true, contactId: data.data.id };
    }
  } catch {
    // Se não é JSON mas retornou 200, considerar sucesso
  }

  return { success: true };
}

// Resultado do envio com motivo detalhado
interface SendResult {
  gerente: string;
  success: boolean;
  error?: string;
  reason?: "sem_telefone" | "contato_nao_existe" | "erro_sendpulse" | "enviado";
}

// Função principal de envio para um gerente
async function enviarParaGerente(
  accessToken: string,
  botId: string,
  gerente: Gerente,
  lojaNome: string,
  templateName: string,
  horario: string
): Promise<SendResult> {
  if (!gerente.telefone) {
    return { gerente: gerente.nome, success: false, error: "Sem telefone cadastrado", reason: "sem_telefone" };
  }

  const normalizedPhone = normalizePhoneNumber(gerente.telefone);
  const parameters = [gerente.nome, horario, lojaNome];

  console.log(`[send-whatsapp-cobranca] Tentando enviar para ${gerente.nome} (${normalizedPhone}) com params:`, parameters);

  // 1. Tentar enviar por telefone (método principal)
  let result = await sendWhatsAppTemplateByPhone(accessToken, botId, normalizedPhone, templateName, parameters);

  if (result.success) {
    return { gerente: gerente.nome, success: true, reason: "enviado" };
  }

  // 2. Se contato não existe, tentar criar e reenviar
  if (result.errorCode === "CONTACT_NOT_FOUND") {
    console.log(`[send-whatsapp-cobranca] Contato não existe para ${gerente.nome}, tentando criar...`);
    
    const createResult = await createContact(accessToken, botId, normalizedPhone, gerente.nome);
    
    if (createResult.success) {
      console.log(`[send-whatsapp-cobranca] Contato criado, tentando reenviar...`);
      
      // Aguardar um pouco para o contato ser indexado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Tentar reenviar
      result = await sendWhatsAppTemplateByPhone(accessToken, botId, normalizedPhone, templateName, parameters);
      
      if (result.success) {
        return { gerente: gerente.nome, success: true, reason: "enviado" };
      }
    }
    
    // Se ainda falhou após criar contato
    return { 
      gerente: gerente.nome, 
      success: false, 
      error: `Contato não existe no SendPulse e não foi possível criar. O número ${normalizedPhone} precisa iniciar uma conversa com o bot primeiro.`,
      reason: "contato_nao_existe"
    };
  }

  // 3. Outro erro do SendPulse
  return { 
    gerente: gerente.nome, 
    success: false, 
    error: result.error || "Erro desconhecido do SendPulse",
    reason: "erro_sendpulse"
  };
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
      console.error("[send-whatsapp-cobranca] Secrets do SendPulse não configurados");
      return new Response(
        JSON.stringify({ success: false, error: "Secrets do SendPulse não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      gerenteId, 
      gerenteIds,
      lojaId, 
      horarioLancamento, 
      nivelCobranca = 1, 
      minutosAtraso = 5,
      isTest = false 
    } = body;

    console.log(`[send-whatsapp-cobranca] Recebido:`, JSON.stringify(body, null, 2));

    // Get SendPulse access token
    const accessToken = await getAccessToken(sendpulseClientId, sendpulseClientSecret);

    // Get current time in Brazil timezone
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = nowBrasil.toISOString().split('T')[0];

    // Se for teste, enviar para todos os gerentes selecionados
    if (isTest && gerenteIds && gerenteIds.length > 0) {
      const { data: gerentes, error: gerentesError } = await supabase
        .from("profiles")
        .select("id, nome, telefone, loja_id")
        .in("id", gerenteIds);

      if (gerentesError) {
        console.error("[send-whatsapp-cobranca] Erro ao buscar gerentes:", gerentesError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar gerentes", results: [] }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar lojas
      const lojaIds = (gerentes || []).filter(g => g.loja_id).map(g => g.loja_id);
      let lojasMap: Record<string, string> = {};
      
      if (lojaIds.length > 0) {
        const { data: lojas } = await supabase
          .from("lojas")
          .select("id, nome")
          .in("id", lojaIds);
        
        if (lojas) {
          lojasMap = Object.fromEntries(lojas.map((l: Loja) => [l.id, l.nome]));
        }
      }

      const templateName = TEMPLATES_POR_NIVEL[1]; // Nível 1 para teste
      const results: SendResult[] = [];
      
      for (const gerente of (gerentes || [])) {
        const lojaNome = gerente.loja_id ? (lojasMap[gerente.loja_id] || "Sua farmácia") : "Sua farmácia";
        
        const sendResult = await enviarParaGerente(
          accessToken,
          sendpulseBotId,
          gerente as Gerente,
          lojaNome,
          templateName,
          horaAtual
        );
        
        results.push(sendResult);

        // Registrar no log (como teste)
        await supabase.from("whatsapp_cobranca_log").insert({
          gerente_id: gerente.id,
          loja_id: gerente.loja_id || '00000000-0000-0000-0000-000000000000',
          data: todayStr,
          horario_lancamento: horaAtual,
          minutos_atraso: 0,
          nivel_cobranca: 0, // 0 indica teste
          template_usado: templateName,
          status: sendResult.success ? 'enviado' : 'erro',
          erro_detalhes: sendResult.error || null
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      // Construir mensagem detalhada
      let message = `Teste enviado para ${successCount} de ${results.length} gerente(s)`;
      if (failCount > 0) {
        const semTelefone = results.filter(r => r.reason === "sem_telefone").length;
        const contatoNaoExiste = results.filter(r => r.reason === "contato_nao_existe").length;
        const erroSendpulse = results.filter(r => r.reason === "erro_sendpulse").length;
        
        const detalhes: string[] = [];
        if (semTelefone > 0) detalhes.push(`${semTelefone} sem telefone`);
        if (contatoNaoExiste > 0) detalhes.push(`${contatoNaoExiste} contato não existe no SendPulse`);
        if (erroSendpulse > 0) detalhes.push(`${erroSendpulse} erro SendPulse`);
        
        if (detalhes.length > 0) {
          message += `. Falhas: ${detalhes.join(", ")}`;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: successCount > 0, // success = true somente se pelo menos 1 enviou
          message,
          results,
          successCount,
          failCount
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Envio real (não teste) - para um gerente específico
    if (!gerenteId) {
      return new Response(
        JSON.stringify({ success: false, error: "gerenteId é obrigatório", results: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar gerente
    const { data: gerente, error: gerenteError } = await supabase
      .from("profiles")
      .select("id, nome, telefone, loja_id")
      .eq("id", gerenteId)
      .single();

    if (gerenteError || !gerente) {
      console.error("[send-whatsapp-cobranca] Gerente não encontrado:", gerenteError);
      return new Response(
        JSON.stringify({ success: false, error: "Gerente não encontrado", results: [] }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome da loja
    let lojaNome = "Sua farmácia";
    if (lojaId || gerente.loja_id) {
      const { data: loja } = await supabase
        .from("lojas")
        .select("nome")
        .eq("id", lojaId || gerente.loja_id)
        .single();
      
      if (loja) {
        lojaNome = loja.nome;
      }
    }

    const templateName = TEMPLATES_POR_NIVEL[nivelCobranca] || TEMPLATES_POR_NIVEL[1];
    
    const result = await enviarParaGerente(
      accessToken,
      sendpulseBotId,
      gerente as Gerente,
      lojaNome,
      templateName,
      horarioLancamento || "10:00"
    );

    // Registrar no log
    await supabase.from("whatsapp_cobranca_log").insert({
      gerente_id: gerente.id,
      loja_id: lojaId || gerente.loja_id || '00000000-0000-0000-0000-000000000000',
      data: todayStr,
      horario_lancamento: horarioLancamento || "10:00",
      minutos_atraso: minutosAtraso,
      nivel_cobranca: nivelCobranca,
      template_usado: templateName,
      status: result.success ? 'enviado' : 'erro',
      erro_detalhes: result.error || null
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error, results: [result] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cobrança nível ${nivelCobranca} enviada para ${gerente.nome}`,
        templateUsed: templateName,
        results: [result]
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-whatsapp-cobranca] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
