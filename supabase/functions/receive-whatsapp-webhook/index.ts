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
 * O SendPulse pode enviar o payload como:
 * - Array de eventos: [{ title: "outgoing_message", ... }, ...]
 * - Objeto único: { title: "outgoing_message", ... }
 * 
 * Estrutura do evento outgoing_message:
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
 *   },
 *   "info": {
 *     "message": {
 *       "channel_data": {
 *         "message_id": "wamid.xxx"
 *       }
 *     }
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
  info?: {
    message?: {
      channel_data?: {
        message_id?: string;
      };
    };
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

    // Obter payload do webhook - pode ser array ou objeto
    let rawPayload: WebhookPayload | WebhookPayload[];
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      rawPayload = await req.json();
    } else {
      // Alguns webhooks podem vir como form-urlencoded ou text
      const text = await req.text();
      console.log(`[receive-whatsapp-webhook] Body raw (não-JSON):`, text);
      try {
        rawPayload = JSON.parse(text);
      } catch {
        console.log(`[receive-whatsapp-webhook] Falha ao parsear body como JSON`);
        rawPayload = { raw: text } as unknown as WebhookPayload;
      }
    }

    // Normalizar: se for array, processar cada item; se for objeto, tratar como array de 1
    const payloads: WebhookPayload[] = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    
    console.log(`[receive-whatsapp-webhook] ${payloads.length} evento(s) recebido(s)`);
    console.log(`[receive-whatsapp-webhook] Payload completo:`, JSON.stringify(rawPayload, null, 2));

    let totalUpdatedReportLogs = 0;
    let totalUpdatedCobrancaLogs = 0;
    let eventosProcessados = 0;
    let eventosIgnorados = 0;

    for (const payload of payloads) {
      // Verificar se é um evento de mensagem de saída
      if (payload.title !== "outgoing_message" || payload.service !== "whatsapp") {
        console.log(`[receive-whatsapp-webhook] Evento ignorado: title=${payload.title}, service=${payload.service}`);
        eventosIgnorados++;
        continue;
      }

      eventosProcessados++;
      
      const phone = payload.contact?.phone;
      // Tentar extrair message_id de múltiplos caminhos possíveis
      const messageId = payload.info?.message?.channel_data?.message_id || payload.message?.id;
      const webhookDate = payload.date ? new Date(payload.date) : new Date();
      const payloadStr = JSON.stringify(payload);

      console.log(`[receive-whatsapp-webhook] Processando evento #${eventosProcessados}:`);
      console.log(`  - phone: ${phone}`);
      console.log(`  - messageId: ${messageId}`);
      console.log(`  - date: ${webhookDate.toISOString()}`);
      console.log(`  - contact.name: ${payload.contact?.name}`);

      if (!phone) {
        console.log(`[receive-whatsapp-webhook] Evento sem telefone, pulando`);
        continue;
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      console.log(`  - normalizedPhone: ${normalizedPhone}`);

      // Buscar e atualizar logs de relatório com status 'aceito' para este telefone
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

        console.log(`[receive-whatsapp-webhook] report_logs com status 'aceito': ${reportLogs.length}, matching phone: ${matchingLogs.length}`);

        if (matchingLogs.length > 0) {
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
              totalUpdatedReportLogs++;
              console.log(`[receive-whatsapp-webhook] ✓ Report log ${log.id} atualizado para 'enviado'`);
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

      console.log(`[receive-whatsapp-webhook] profiles matching phone: ${matchingProfiles.length}`);

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
          console.log(`[receive-whatsapp-webhook] cobranca_logs com status 'aceito': ${cobrancaLogs.length}`);
          
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
              totalUpdatedCobrancaLogs++;
              console.log(`[receive-whatsapp-webhook] ✓ Cobrança log ${log.id} atualizado para 'enviado'`);
            }
          }
        }
      }
    }

    console.log(`[receive-whatsapp-webhook] === RESUMO ===`);
    console.log(`  - Eventos recebidos: ${payloads.length}`);
    console.log(`  - Eventos processados (outgoing_message): ${eventosProcessados}`);
    console.log(`  - Eventos ignorados: ${eventosIgnorados}`);
    console.log(`  - Report logs atualizados: ${totalUpdatedReportLogs}`);
    console.log(`  - Cobrança logs atualizados: ${totalUpdatedCobrancaLogs}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processado",
        stats: {
          eventos_recebidos: payloads.length,
          eventos_processados: eventosProcessados,
          eventos_ignorados: eventosIgnorados,
          report_logs_atualizados: totalUpdatedReportLogs,
          cobranca_logs_atualizados: totalUpdatedCobrancaLogs
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
