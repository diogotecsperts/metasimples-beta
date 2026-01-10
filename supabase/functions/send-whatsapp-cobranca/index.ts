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
  1: "lembrete_meta_v1",
  2: "lembrete_meta_urgente_v2",
  3: "lembrete_meta_final_v1",
};

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
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
    throw new Error(`Erro ao obter token SendPulse: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendWhatsAppTemplateByPhone(
  accessToken: string,
  botId: string,
  phone: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string; errorCode?: string; messageId?: string; sendpulseStatus?: number; fullResponse?: string }> {
  const bodyParameters = parameters.map(text => ({ type: "text", text }));
  
  const requestBody = {
    bot_id: botId,
    phone: phone,
    template: {
      name: templateName,
      language: { policy: "deterministic", code: "pt_BR" },
      components: [{ type: "body", parameters: bodyParameters }]
    }
  };

  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/sendTemplateByPhone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  const sendpulseStatus = response.status;

  if (!response.ok) {
    try {
      const errorData = JSON.parse(responseText);
      const isBanned = responseText.toLowerCase().includes("banned");
      const isNotFound = responseText.toLowerCase().includes("does not exist");
      
      if (isBanned) {
        return { success: false, error: errorData.message, errorCode: "CONTACT_BANNED", sendpulseStatus, fullResponse: responseText };
      }
      if (isNotFound) {
        return { success: false, error: errorData.message, errorCode: "CONTACT_NOT_FOUND", sendpulseStatus, fullResponse: responseText };
      }
      return { success: false, error: `HTTP ${response.status}: ${errorData.message || responseText}`, sendpulseStatus, fullResponse: responseText };
    } catch {
      return { success: false, error: `HTTP ${response.status}: ${responseText}`, sendpulseStatus, fullResponse: responseText };
    }
  }

  try {
    const responseJson = JSON.parse(responseText);
    const messageId = responseJson.data?.data?.message_id || responseJson.data?.message_id || responseJson.message_id;
    return { success: true, messageId, sendpulseStatus, fullResponse: responseText };
  } catch {
    return { success: true, sendpulseStatus, fullResponse: responseText };
  }
}

async function createContact(accessToken: string, botId: string, phone: string, name: string): Promise<{ success: boolean; contactId?: string }> {
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, phone, name }),
  });
  if (!response.ok) return { success: false };
  try {
    const data = await response.json();
    return { success: true, contactId: data.data?.id };
  } catch {
    return { success: true };
  }
}

async function enableContact(accessToken: string, contactId: string): Promise<boolean> {
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/enable", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contact_id: contactId }),
  });
  return response.ok;
}

async function sendWhatsAppTemplate(
  accessToken: string,
  contactId: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string; messageId?: string; sendpulseStatus?: number; fullResponse?: string }> {
  const bodyParameters = parameters.map(text => ({ type: "text", text }));
  
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/sendTemplate", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contact_id: contactId,
      template: {
        name: templateName,
        language: { policy: "deterministic", code: "pt_BR" },
        components: [{ type: "body", parameters: bodyParameters }]
      }
    }),
  });

  const responseText = await response.text();
  
  try {
    const responseJson = JSON.parse(responseText);
    const messageId = responseJson.data?.message_id || responseJson.message_id;
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${responseText}`, messageId, sendpulseStatus: response.status, fullResponse: responseText };
    }
    return { success: true, messageId, sendpulseStatus: response.status, fullResponse: responseText };
  } catch {
    return { success: !response.ok ? false : true, error: !response.ok ? responseText : undefined, sendpulseStatus: response.status, fullResponse: responseText };
  }
}

interface SendResult {
  gerente: string;
  success: boolean;
  error?: string;
  reason?: "sem_telefone" | "contato_nao_existe" | "contato_banido" | "erro_sendpulse" | "enviado";
  messageId?: string;
  sendpulseStatus?: number;
  fullResponse?: string;
  metodoEnvio?: "phone" | "contact_id";
  contactIdUsado?: string;
  telefoneUsado?: string;
}

// Limite de tentativas de recuperação automática
const MAX_RECOVERY_ATTEMPTS = 3;

// Busca contact_id e dados do banco de dados
async function getContactFromDB(supabase: any, telefone: string): Promise<{ 
  contactId: string | null; 
  status: string | null;
  tentativasRecuperacao: number;
}> {
  const { data } = await supabase
    .from("sendpulse_contacts")
    .select("sendpulse_contact_id, status, tentativas_falha_consecutivas")
    .eq("telefone", telefone)
    .maybeSingle();

  return {
    contactId: data?.sendpulse_contact_id || null,
    status: data?.status || null,
    tentativasRecuperacao: data?.tentativas_falha_consecutivas || 0
  };
}

// Atualiza status do contato no banco após envio
async function updateContactStatus(
  supabase: any, 
  telefone: string, 
  status: 'ativo' | 'bloqueado', 
  contactId?: string,
  incrementarTentativas: boolean = false
): Promise<void> {
  const updateData: any = { status, updated_at: new Date().toISOString() };

  if (status === 'ativo') {
    updateData.ultimo_envio_sucesso_at = new Date().toISOString();
    updateData.tentativas_falha_consecutivas = 0;
  } else if (status === 'bloqueado') {
    updateData.ultimo_bloqueio_at = new Date().toISOString();
  }

  if (contactId) {
    updateData.sendpulse_contact_id = contactId;
  }

  // Incrementar contador de tentativas falhas se solicitado
  if (incrementarTentativas) {
    const { data } = await supabase
      .from("sendpulse_contacts")
      .select("tentativas_falha_consecutivas")
      .eq("telefone", telefone)
      .maybeSingle();
    updateData.tentativas_falha_consecutivas = (data?.tentativas_falha_consecutivas || 0) + 1;
  }

  await supabase.from("sendpulse_contacts").update(updateData).eq("telefone", telefone);
}

// Tenta recuperar contato bloqueado automaticamente
async function tryRecoverBlockedContact(
  supabase: any,
  accessToken: string,
  botId: string,
  telefone: string,
  contactId: string
): Promise<{ recovered: boolean; reason: string }> {
  console.log(`[send-whatsapp-cobranca] Tentando recuperar contato bloqueado: ${telefone}`);
  
  // Verificar se já excedeu limite de tentativas
  const { tentativasRecuperacao } = await getContactFromDB(supabase, telefone);
  
  if (tentativasRecuperacao >= MAX_RECOVERY_ATTEMPTS) {
    console.log(`[send-whatsapp-cobranca] Contato ${telefone} excedeu limite de ${MAX_RECOVERY_ATTEMPTS} tentativas`);
    return { recovered: false, reason: `Excedeu limite de ${MAX_RECOVERY_ATTEMPTS} tentativas de recuperação` };
  }
  
  // Incrementar contador antes de tentar
  await updateContactStatus(supabase, telefone, 'bloqueado', contactId, true);
  
  // Tentar habilitar o contato
  const enabled = await enableContact(accessToken, contactId);
  if (!enabled) {
    console.log(`[send-whatsapp-cobranca] Falha ao habilitar contato ${telefone}`);
    return { recovered: false, reason: "Falha ao habilitar via API SendPulse" };
  }
  
  // Verificar status atual no SendPulse
  const checkUrl = `https://api.sendpulse.com/whatsapp/contacts/getByPhone?bot_id=${botId}&phone=${encodeURIComponent(telefone)}`;
  try {
    const response = await fetch(checkUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      const isActive = data.data?.status === 1;
      
      if (isActive) {
        await updateContactStatus(supabase, telefone, 'ativo', contactId);
        console.log(`[send-whatsapp-cobranca] Contato ${telefone} recuperado com sucesso!`);
        return { recovered: true, reason: "Contato reativado com sucesso" };
      }
    }
  } catch (e) {
    console.error(`[send-whatsapp-cobranca] Erro ao verificar status do contato:`, e);
  }
  
  return { recovered: false, reason: "Contato continua bloqueado após enableContact" };
}

async function enviarParaGerente(
  supabase: any,
  accessToken: string,
  botId: string,
  gerente: Gerente,
  lojaNome: string,
  templateName: string,
  horario: string,
  metodoForcar?: 'phone' | 'contact_id'
): Promise<SendResult> {
  if (!gerente.telefone) {
    return { gerente: gerente.nome, success: false, error: "Sem telefone cadastrado", reason: "sem_telefone" };
  }

  const normalizedPhone = normalizePhoneNumber(gerente.telefone);
  const parameters = [gerente.nome, horario, lojaNome];

  // Buscar contact_id do banco
  const { contactId: dbContactId } = await getContactFromDB(supabase, normalizedPhone);

  // MODO FORÇADO: TELEFONE APENAS
  if (metodoForcar === 'phone') {
    const result = await sendWhatsAppTemplateByPhone(accessToken, botId, normalizedPhone, templateName, parameters);
    if (result.success) {
      await updateContactStatus(supabase, normalizedPhone, 'ativo');
      return { gerente: gerente.nome, success: true, reason: "enviado", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse, metodoEnvio: "phone", telefoneUsado: normalizedPhone };
    }
    return { gerente: gerente.nome, success: false, error: result.error, reason: "erro_sendpulse", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
  }

  // MODO FORÇADO: CONTACT_ID APENAS
  if (metodoForcar === 'contact_id') {
    if (!dbContactId) {
      return { gerente: gerente.nome, success: false, error: `Contact ID não encontrado para ${normalizedPhone}`, reason: "contato_nao_existe" };
    }
    const result = await sendWhatsAppTemplate(accessToken, dbContactId, templateName, parameters);
    if (result.success) {
      await updateContactStatus(supabase, normalizedPhone, 'ativo', dbContactId);
      return { gerente: gerente.nome, success: true, reason: "enviado", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse, metodoEnvio: "contact_id", contactIdUsado: dbContactId };
    }
    return { gerente: gerente.nome, success: false, error: result.error, reason: "erro_sendpulse", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
  }

  // MODO AUTOMÁTICO: TELEFONE PRIMEIRO, CONTACT_ID FALLBACK
  let result = await sendWhatsAppTemplateByPhone(accessToken, botId, normalizedPhone, templateName, parameters);

  if (result.success) {
    await updateContactStatus(supabase, normalizedPhone, 'ativo');
    return { gerente: gerente.nome, success: true, reason: "enviado", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse, metodoEnvio: "phone", telefoneUsado: normalizedPhone };
  }

  // Se contato não existe, tentar criar
  if (result.errorCode === "CONTACT_NOT_FOUND") {
    const createResult = await createContact(accessToken, botId, normalizedPhone, gerente.nome);
    if (createResult.success) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await sendWhatsAppTemplateByPhone(accessToken, botId, normalizedPhone, templateName, parameters);
      if (result.success) {
        await updateContactStatus(supabase, normalizedPhone, 'ativo');
        return { gerente: gerente.nome, success: true, reason: "enviado", messageId: result.messageId, metodoEnvio: "phone", telefoneUsado: normalizedPhone, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
      }
    }
    return { gerente: gerente.nome, success: false, error: `Contato não existe. O número ${normalizedPhone} precisa iniciar conversa com o bot.`, reason: "contato_nao_existe", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
  }

  // Se contato está banido, tentar recuperação automática e fallback via contact_id
  if (result.errorCode === "CONTACT_BANNED") {
    if (dbContactId) {
      // Primeiro: tentar recuperação automática
      const recovery = await tryRecoverBlockedContact(supabase, accessToken, botId, normalizedPhone, dbContactId);
      
      if (recovery.recovered) {
        // Contato recuperado, tentar enviar via contact_id
        console.log(`[send-whatsapp-cobranca] Contato ${normalizedPhone} recuperado! Reenviando...`);
        const retryResult = await sendWhatsAppTemplate(accessToken, dbContactId, templateName, parameters);
        if (retryResult.success) {
          await updateContactStatus(supabase, normalizedPhone, 'ativo', dbContactId);
          return { gerente: gerente.nome, success: true, reason: "enviado", messageId: retryResult.messageId, sendpulseStatus: retryResult.sendpulseStatus, fullResponse: retryResult.fullResponse, metodoEnvio: "contact_id", contactIdUsado: dbContactId };
        }
        await updateContactStatus(supabase, normalizedPhone, 'bloqueado', dbContactId, true);
        return { gerente: gerente.nome, success: false, error: `Recuperado mas falhou ao enviar: ${retryResult.error}`, reason: "contato_banido", messageId: retryResult.messageId, sendpulseStatus: retryResult.sendpulseStatus, fullResponse: retryResult.fullResponse };
      }
      
      // FALLBACK: Tentar enviar via contact_id mesmo sem recuperação bem-sucedida
      console.log(`[send-whatsapp-cobranca] Recuperação falhou (${recovery.reason}). Tentando fallback via contact_id: ${dbContactId}`);
      const fallbackResult = await sendWhatsAppTemplate(accessToken, dbContactId, templateName, parameters);
      
      if (fallbackResult.success) {
        console.log(`[send-whatsapp-cobranca] Fallback via contact_id funcionou para ${normalizedPhone}!`);
        await updateContactStatus(supabase, normalizedPhone, 'ativo', dbContactId);
        return { 
          gerente: gerente.nome, 
          success: true, 
          reason: "enviado", 
          messageId: fallbackResult.messageId, 
          sendpulseStatus: fallbackResult.sendpulseStatus, 
          fullResponse: fallbackResult.fullResponse, 
          metodoEnvio: "contact_id", 
          contactIdUsado: dbContactId 
        };
      }
      
      // Ambos métodos falharam
      console.log(`[send-whatsapp-cobranca] Todos os métodos falharam para ${normalizedPhone}: telefone=BANNED, recovery=${recovery.reason}, fallback=${fallbackResult.error}`);
      await updateContactStatus(supabase, normalizedPhone, 'bloqueado', dbContactId, true);
      return { 
        gerente: gerente.nome, 
        success: false, 
        error: `Contato banido. Recuperação: ${recovery.reason}. Fallback contact_id: ${fallbackResult.error}`, 
        reason: "contato_banido", 
        messageId: fallbackResult.messageId, 
        sendpulseStatus: fallbackResult.sendpulseStatus, 
        fullResponse: fallbackResult.fullResponse,
        metodoEnvio: "contact_id",
        contactIdUsado: dbContactId
      };
    }
    return { gerente: gerente.nome, success: false, error: `Contato banido. Sem contact_id no banco para fallback.`, reason: "contato_banido", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
  }

  return { gerente: gerente.nome, success: false, error: result.error || "Erro desconhecido", reason: "erro_sendpulse", messageId: result.messageId, sendpulseStatus: result.sendpulseStatus, fullResponse: result.fullResponse };
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
      return new Response(JSON.stringify({ success: false, error: "Secrets do SendPulse não configurados" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { gerenteId, gerenteIds, lojaId, horarioLancamento, nivelCobranca = 1, minutosAtraso = 5, isTest = false, metodoForcar } = body;

    const accessToken = await getAccessToken(sendpulseClientId, sendpulseClientSecret);

    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = nowBrasil.toISOString().split('T')[0];

    // Modo teste: enviar para lista de gerentes
    if (isTest && gerenteIds && gerenteIds.length > 0) {
      const { data: gerentes } = await supabase.from("profiles").select("id, nome, telefone, loja_id").in("id", gerenteIds);
      const lojaIds = (gerentes || []).filter((g: any) => g.loja_id).map((g: any) => g.loja_id);
      let lojasMap: Record<string, string> = {};
      if (lojaIds.length > 0) {
        const { data: lojas } = await supabase.from("lojas").select("id, nome").in("id", lojaIds);
        if (lojas) lojasMap = Object.fromEntries(lojas.map((l: Loja) => [l.id, l.nome]));
      }

      const templateName = TEMPLATES_POR_NIVEL[1];
      const results: SendResult[] = [];
      
      for (const gerente of (gerentes || [])) {
        const lojaNome = gerente.loja_id ? (lojasMap[gerente.loja_id] || "Sua farmácia") : "Sua farmácia";
        const sendResult = await enviarParaGerente(supabase, accessToken, sendpulseBotId, gerente as Gerente, lojaNome, templateName, horaAtual, metodoForcar);
        results.push(sendResult);

        await supabase.from("whatsapp_cobranca_log").insert({
          gerente_id: gerente.id, loja_id: gerente.loja_id || '00000000-0000-0000-0000-000000000000', data: todayStr,
          horario_lancamento: horaAtual, minutos_atraso: 0, nivel_cobranca: 0, template_usado: templateName,
          status: sendResult.success ? 'enviado' : 'erro', erro_detalhes: sendResult.error || null,
          sendpulse_response: sendResult.fullResponse || null, sendpulse_message_id: sendResult.messageId || null, sendpulse_status: sendResult.sendpulseStatus || null,
          status_entrega: sendResult.success ? "aceito" : "falhou", metodo_envio: sendResult.metodoEnvio || "phone", contact_id_usado: sendResult.contactIdUsado || null, telefone_usado: sendResult.telefoneUsado || null
        });
      }

      const successCount = results.filter(r => r.success).length;
      return new Response(JSON.stringify({ success: successCount > 0, message: `Teste enviado para ${successCount} de ${results.length} gerente(s)`, results, successCount, failCount: results.length - successCount }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Envio real
    if (!gerenteId) {
      return new Response(JSON.stringify({ success: false, error: "gerenteId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: gerente } = await supabase.from("profiles").select("id, nome, telefone, loja_id").eq("id", gerenteId).single();
    if (!gerente) {
      return new Response(JSON.stringify({ success: false, error: "Gerente não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let lojaNome = "Sua farmácia";
    if (lojaId || gerente.loja_id) {
      const { data: loja } = await supabase.from("lojas").select("nome").eq("id", lojaId || gerente.loja_id).single();
      if (loja) lojaNome = loja.nome;
    }

    const templateName = TEMPLATES_POR_NIVEL[nivelCobranca] || TEMPLATES_POR_NIVEL[1];
    const result = await enviarParaGerente(supabase, accessToken, sendpulseBotId, gerente as Gerente, lojaNome, templateName, horarioLancamento || "10:00");

    await supabase.from("whatsapp_cobranca_log").insert({
      gerente_id: gerente.id, loja_id: lojaId || gerente.loja_id || '00000000-0000-0000-0000-000000000000', data: todayStr,
      horario_lancamento: horarioLancamento || "10:00", minutos_atraso: minutosAtraso, nivel_cobranca: nivelCobranca, template_usado: templateName,
      status: result.success ? 'enviado' : 'erro', erro_detalhes: result.error || null,
      sendpulse_response: result.fullResponse || null, sendpulse_message_id: result.messageId || null, sendpulse_status: result.sendpulseStatus || null,
      status_entrega: result.success ? "aceito" : "falhou", metodo_envio: result.metodoEnvio || "phone", contact_id_usado: result.contactIdUsado || null, telefone_usado: result.telefoneUsado || null
    });

    if (!result.success) {
      return new Response(JSON.stringify({ success: false, error: result.error, results: [result] }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, message: `Cobrança nível ${nivelCobranca} enviada para ${gerente.nome}`, results: [result] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[send-whatsapp-cobranca] Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
