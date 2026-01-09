import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("SENDPULSE_CLIENT_ID");
  const clientSecret = Deno.env.get("SENDPULSE_CLIENT_SECRET");
  
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
    throw new Error(`Erro ao obter token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, contactId, logId, logTable } = await req.json();
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "messageId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-message-status] Verificando status de ${messageId}, contact: ${contactId}`);

    const accessToken = await getAccessToken();
    const botId = Deno.env.get("SENDPULSE_BOT_ID");

    if (!contactId) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          error: "contactId não disponível para buscar mensagem" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar mensagens do contato usando a API do SendPulse
    const url = `https://api.sendpulse.com/whatsapp/chats/messages?bot_id=${botId}&contact_id=${contactId}&limit=50`;
    console.log(`[check-message-status] Buscando em: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const responseText = await response.text();
    console.log(`[check-message-status] Resposta:`, response.status, responseText.substring(0, 500));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          error: `Erro da API: ${response.status}`,
          details: responseText
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let messages;
    try {
      messages = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ found: false, error: "Resposta inválida da API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-message-status] Mensagens encontradas:`, messages.data?.length || 0);

    // Procurar a mensagem específica pelo ID
    const mensagem = messages.data?.find((m: any) => 
      m.id === messageId || m.message_id === messageId || m.external_id === messageId
    );

    if (mensagem) {
      console.log(`[check-message-status] Mensagem encontrada:`, JSON.stringify(mensagem));
      
      // Determinar status baseado nos dados
      const statusSendPulse = mensagem.status || mensagem.delivery_status || 'unknown';
      const isDelivered = ['sent', 'delivered', 'read'].includes(statusSendPulse.toLowerCase());
      
      // Se encontrou e foi entregue, atualizar o log no banco
      if (isDelivered && logId && logTable) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const tableName = logTable === 'cobranca' ? 'whatsapp_cobranca_log' : 'whatsapp_report_log';
        
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ 
            status_entrega: 'enviado',
            webhook_recebido_em: new Date().toISOString()
          })
          .eq("id", logId);

        if (updateError) {
          console.error(`[check-message-status] Erro ao atualizar log:`, updateError);
        } else {
          console.log(`[check-message-status] Log atualizado com sucesso`);
        }
      }

      return new Response(
        JSON.stringify({
          found: true,
          status: statusSendPulse,
          delivered: isDelivered,
          updated: isDelivered && logId,
          message: {
            id: mensagem.id,
            status: statusSendPulse,
            created_at: mensagem.created_at
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mensagem não encontrada nas últimas 50
    return new Response(
      JSON.stringify({ 
        found: false,
        message: "Mensagem não encontrada nas últimas 50 mensagens do contato"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[check-message-status] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
