import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function para receber webhooks do SendPulse
 * 
 * Este endpoint recebe notificações de mensagens enviadas (outgoing_message)
 * e atualiza os logs de WhatsApp com o status real de entrega.
 * 
 * Estrutura esperada do webhook SendPulse (outgoing_message):
 * {
 *   "service": "whatsapp",
 *   "title": "outgoing_message",
 *   "bot_id": "xxx",
 *   "contact": {
 *     "id": "xxx",
 *     "phone": "5582981627838",
 *     "name": "Nome do Contato"
 *   },
 *   "date": 1736092619000,
 *   "message": {
 *     "id": "wamid.xxx",
 *     "type": "template",
 *     "text": "..."
 *   }
 * }
 */

interface WebhookPayload {
  service?: string;
  title?: string;
  bot_id?: string;
  contact?: {
    id?: string;
    phone?: string;
    name?: string;
  };
  date?: number;
  message?: {
    id?: string;
    type?: string;
    text?: string;
  };
  // Campos extras que podem vir
  [key: string]: unknown;
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

const handler = async (req: Request): Promise<Response> => {
  // Log de entrada para debug
  const url = new URL(req.url);
  console.log(`[receive-whatsapp-webhook] Request: ${req.method} ${url.pathname}`);
  
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter payload do webhook
    let payload: WebhookPayload;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      // Alguns webhooks podem vir como form-urlencoded
      const text = await req.text();
      console.log(`[receive-whatsapp-webhook] Body raw:`, text);
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text } as unknown as WebhookPayload;
      }
    }

    console.log(`[receive-whatsapp-webhook] Payload recebido:`, JSON.stringify(payload, null, 2));

    // Verificar se é um evento de mensagem de saída
    if (payload.title !== "outgoing_message" || payload.service !== "whatsapp") {
      console.log(`[receive-whatsapp-webhook] Evento ignorado: title=${payload.title}, service=${payload.service}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Evento ignorado (não é outgoing_message)" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const phone = payload.contact?.phone;
    const messageId = payload.message?.id;
    const webhookDate = payload.date ? new Date(payload.date) : new Date();
    const payloadStr = JSON.stringify(payload);

    console.log(`[receive-whatsapp-webhook] Processando: phone=${phone}, messageId=${messageId}`);

    if (!phone) {
      console.log(`[receive-whatsapp-webhook] Webhook sem telefone, ignorando`);
      return new Response(
        JSON.stringify({ success: true, message: "Webhook sem telefone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    let updatedReportLogs = 0;
    let updatedCobrancaLogs = 0;

    // Buscar e atualizar logs de relatório com status 'aceito' para este telefone
    // (aceito = foi aceito pelo SendPulse mas ainda não confirmamos via webhook)
    const { data: reportLogs, error: reportError } = await supabase
      .from("whatsapp_report_log")
      .select("id, admin_telefone")
      .eq("status_entrega", "aceito")
      .order("enviado_em", { ascending: false })
      .limit(50);

    if (reportError) {
      console.error(`[receive-whatsapp-webhook] Erro ao buscar report_logs:`, reportError);
    } else if (reportLogs) {
      // Filtrar por telefone normalizado
      const matchingLogs = reportLogs.filter(log => {
        const logPhone = normalizePhoneNumber(log.admin_telefone || "");
        return logPhone === normalizedPhone;
      });

      if (matchingLogs.length > 0) {
        console.log(`[receive-whatsapp-webhook] Encontrados ${matchingLogs.length} report_logs para atualizar`);
        
        for (const log of matchingLogs) {
          const { error: updateError } = await supabase
            .from("whatsapp_report_log")
            .update({
              status_entrega: "enviado",
              webhook_recebido_em: webhookDate.toISOString(),
              webhook_payload: payloadStr
            })
            .eq("id", log.id);

          if (updateError) {
            console.error(`[receive-whatsapp-webhook] Erro ao atualizar report_log ${log.id}:`, updateError);
          } else {
            updatedReportLogs++;
            console.log(`[receive-whatsapp-webhook] Report log ${log.id} atualizado para 'enviado'`);
          }
        }
      }
    }

    // Buscar logs de cobrança pendentes
    // Precisamos buscar gerentes pelo telefone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, telefone")
      .not("telefone", "is", null);

    // Encontrar gerentes com este telefone
    const matchingProfiles = (profiles || []).filter(p => {
      const profilePhone = normalizePhoneNumber(p.telefone || "");
      return profilePhone === normalizedPhone;
    });

    if (matchingProfiles.length > 0) {
      const gerenteIds = matchingProfiles.map(p => p.id);
      
      const { data: cobrancaLogs, error: cobrancaError } = await supabase
        .from("whatsapp_cobranca_log")
        .select("id, gerente_id")
        .eq("status_entrega", "aceito")
        .in("gerente_id", gerenteIds)
        .order("enviado_em", { ascending: false })
        .limit(50);

      if (cobrancaError) {
        console.error(`[receive-whatsapp-webhook] Erro ao buscar cobranca_logs:`, cobrancaError);
      } else if (cobrancaLogs && cobrancaLogs.length > 0) {
        console.log(`[receive-whatsapp-webhook] Encontrados ${cobrancaLogs.length} cobranca_logs para atualizar`);
        
        for (const log of cobrancaLogs) {
          const { error: updateError } = await supabase
            .from("whatsapp_cobranca_log")
            .update({
              status_entrega: "enviado",
              webhook_recebido_em: webhookDate.toISOString(),
              webhook_payload: payloadStr
            })
            .eq("id", log.id);

          if (updateError) {
            console.error(`[receive-whatsapp-webhook] Erro ao atualizar cobranca_log ${log.id}:`, updateError);
          } else {
            updatedCobrancaLogs++;
            console.log(`[receive-whatsapp-webhook] Cobrança log ${log.id} atualizado para 'enviado'`);
          }
        }
      }
    }

    console.log(`[receive-whatsapp-webhook] Resumo: ${updatedReportLogs} report_logs, ${updatedCobrancaLogs} cobranca_logs atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processado",
        updated: {
          report_logs: updatedReportLogs,
          cobranca_logs: updatedCobrancaLogs
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error(`[receive-whatsapp-webhook] Erro:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
};

serve(handler);
