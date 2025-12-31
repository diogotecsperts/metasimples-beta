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

    // Mapeamento fixo de telefone -> contact_id (mesmo do send-whatsapp-report)
    const phoneToContactId: Record<string, string> = {
      "+5582981627838": "69322fead2b7eee6000b2336"  // Diogo - Proprietário (ativo)
    };

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
        const contactId = phoneToContactId[normalizedPhone];
        
        if (!contactId) {
          console.log(`[send-whatsapp-cobranca] Contact ID não mapeado para ${gerente.nome} (${normalizedPhone})`);
          results.push({
            gerente: gerente.nome,
            success: false,
            error: `Contact ID não configurado para ${normalizedPhone}`
          });
          continue;
        }

        const lojaNome = gerente.loja_id ? (lojasMap[gerente.loja_id] || "Sua farmácia") : "Sua farmácia";
        const templateName = TEMPLATES_POR_NIVEL[1]; // Nível 1 para teste
        
        // Get current time for test
        const now = new Date();
        const brasilOffsetMs = -3 * 60 * 60 * 1000;
        const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
        const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        // Parâmetros: {{1}} nome, {{2}} horário, {{3}} loja
        const parameters = [gerente.nome, horaAtual, lojaNome];
        
        console.log(`[send-whatsapp-cobranca] Enviando teste para ${gerente.nome} com params:`, parameters);
        
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
    const contactId = phoneToContactId[normalizedPhone];
    
    if (!contactId) {
      console.log(`[send-whatsapp-cobranca] Contact ID não mapeado para ${gerente.nome} (${normalizedPhone})`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Contact ID não configurado para ${normalizedPhone}. Adicione o mapeamento no código.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templateName = TEMPLATES_POR_NIVEL[nivelCobranca] || TEMPLATES_POR_NIVEL[1];
    
    // Parâmetros: {{1}} nome, {{2}} horário, {{3}} loja
    const parameters = [gerente.nome, horarioLancamento || "10:00", lojaNome];
    
    console.log(`[send-whatsapp-cobranca] Enviando cobrança nível ${nivelCobranca} para ${gerente.nome} com params:`, parameters);
    
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
