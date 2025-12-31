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

interface SendPulseContact {
  id: string;
  status: number;
  phone: string;
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

async function getContactByPhone(
  accessToken: string,
  botId: string,
  phone: string
): Promise<SendPulseContact | null> {
  console.log(`[send-whatsapp-cobranca] Buscando contato pelo telefone ${phone}...`);
  
  const url = `https://api.sendpulse.com/whatsapp/contacts/getByPhone?bot_id=${botId}&phone=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-cobranca] Resposta getContactByPhone:`, response.status, responseText);

  if (!response.ok) {
    console.log(`[send-whatsapp-cobranca] Contato não encontrado para ${phone}`);
    return null;
  }

  try {
    const data = JSON.parse(responseText);
    if (data.success && data.data) {
      return {
        id: data.data.id,
        status: data.data.status,
        phone: data.data.phone || phone
      };
    }
  } catch (e) {
    console.error(`[send-whatsapp-cobranca] Erro ao parsear resposta:`, e);
  }

  return null;
}

async function enableContact(
  accessToken: string,
  contactId: string
): Promise<boolean> {
  console.log(`[send-whatsapp-cobranca] Tentando habilitar contato ${contactId}...`);
  
  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/enable", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contact_id: contactId }),
  });

  const ok = response.ok;
  console.log(`[send-whatsapp-cobranca] Resultado enableContact: ${ok}`);
  return ok;
}

async function sendWhatsAppTemplateByContactId(
  accessToken: string,
  contactId: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; error?: string }> {
  console.log(`[send-whatsapp-cobranca] Enviando template ${templateName} para contact_id ${contactId}...`);
  
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

  console.log(`[send-whatsapp-cobranca] Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch("https://api.sendpulse.com/whatsapp/contacts/sendTemplate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[send-whatsapp-cobranca] Resposta sendTemplate:`, response.status, responseText);

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}: ${responseText}` };
  }

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

    // Se for teste, enviar para todos os gerentes selecionados
    if (isTest && gerenteIds && gerenteIds.length > 0) {
      const { data: gerentes, error: gerentesError } = await supabase
        .from("profiles")
        .select("id, nome, telefone, loja_id")
        .in("id", gerenteIds);

      if (gerentesError) {
        console.error("[send-whatsapp-cobranca] Erro ao buscar gerentes:", gerentesError);
        throw new Error("Erro ao buscar gerentes");
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

      const results: { gerente: string; success: boolean; error?: string }[] = [];
      
      for (const gerente of (gerentes || [])) {
        if (!gerente.telefone) {
          results.push({ gerente: gerente.nome, success: false, error: "Sem telefone" });
          continue;
        }

        const normalizedPhone = normalizePhoneNumber(gerente.telefone);
        
        // Buscar contact_id dinamicamente via API do SendPulse
        const contact = await getContactByPhone(accessToken, sendpulseBotId, normalizedPhone);
        
        if (!contact) {
          console.log(`[send-whatsapp-cobranca] Contato não encontrado no SendPulse para ${gerente.nome} (${normalizedPhone})`);
          results.push({
            gerente: gerente.nome,
            success: false,
            error: `Contato não encontrado no SendPulse para ${normalizedPhone}. O número precisa ter iniciado uma conversa com o bot primeiro.`
          });
          continue;
        }

        // Se contato está desabilitado (status != 1), tentar habilitar
        if (contact.status !== 1) {
          console.log(`[send-whatsapp-cobranca] Contato ${gerente.nome} está desabilitado (status ${contact.status}), tentando habilitar...`);
          await enableContact(accessToken, contact.id);
        }

        const contactId = contact.id;
        const lojaNome = gerente.loja_id ? (lojasMap[gerente.loja_id] || "Sua farmácia") : "Sua farmácia";
        const templateName = TEMPLATES_POR_NIVEL[1]; // Nível 1 para teste
        
        // Get current time for test
        const now = new Date();
        const brasilOffsetMs = -3 * 60 * 60 * 1000;
        const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
        const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Parâmetros: {{1}} nome, {{2}} horário, {{3}} loja
        const parameters = [gerente.nome, horaAtual, lojaNome];
        
        console.log(`[send-whatsapp-cobranca] Enviando teste para ${gerente.nome} (contact_id: ${contactId}) com params:`, parameters);
        
        const result = await sendWhatsAppTemplateByContactId(
          accessToken,
          contactId,
          templateName,
          parameters
        );
        
        results.push({
          gerente: gerente.nome,
          success: result.success,
          error: result.error
        });

        // Registrar no log (como teste)
        await supabase.from("whatsapp_cobranca_log").insert({
          gerente_id: gerente.id,
          loja_id: gerente.loja_id || '00000000-0000-0000-0000-000000000000',
          data: nowBrasil.toISOString().split('T')[0],
          horario_lancamento: horaAtual,
          minutos_atraso: 0,
          nivel_cobranca: 0, // 0 indica teste
          template_usado: templateName,
          status: result.success ? 'enviado' : 'erro',
          erro_detalhes: result.error || null
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Teste enviado para ${successCount} gerente(s)`,
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
        JSON.stringify({ success: false, error: "gerenteId é obrigatório" }),
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
        JSON.stringify({ success: false, error: "Gerente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gerente.telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "Gerente sem telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const normalizedPhone = normalizePhoneNumber(gerente.telefone);
    
    // Buscar contact_id dinamicamente via API do SendPulse
    const contact = await getContactByPhone(accessToken, sendpulseBotId, normalizedPhone);
    
    if (!contact) {
      console.log(`[send-whatsapp-cobranca] Contato não encontrado no SendPulse para ${gerente.nome} (${normalizedPhone})`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Contato não encontrado no SendPulse para ${normalizedPhone}. O número precisa ter iniciado uma conversa com o bot primeiro.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se contato está desabilitado (status != 1), tentar habilitar
    if (contact.status !== 1) {
      console.log(`[send-whatsapp-cobranca] Contato ${gerente.nome} está desabilitado (status ${contact.status}), tentando habilitar...`);
      await enableContact(accessToken, contact.id);
    }

    const contactId = contact.id;
    const templateName = TEMPLATES_POR_NIVEL[nivelCobranca] || TEMPLATES_POR_NIVEL[1];
    
    // Parâmetros: {{1}} nome, {{2}} horário, {{3}} loja
    const parameters = [gerente.nome, horarioLancamento || "10:00", lojaNome];
    
    console.log(`[send-whatsapp-cobranca] Enviando cobrança nível ${nivelCobranca} para ${gerente.nome} (contact_id: ${contactId}) com params:`, parameters);
    
    const result = await sendWhatsAppTemplateByContactId(
      accessToken,
      contactId,
      templateName,
      parameters
    );

    // Get current date in Brazil timezone
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const todayStr = nowBrasil.toISOString().split('T')[0];

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
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cobrança nível ${nivelCobranca} enviada para ${gerente.nome}`,
        templateUsed: templateName
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-whatsapp-cobranca] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
