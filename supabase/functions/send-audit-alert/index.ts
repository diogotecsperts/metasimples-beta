import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criou",
  update: "Editou",
  delete: "Excluiu",
};

const ENTITY_LABELS: Record<string, string> = {
  loja: "Loja",
  gerente: "Gerente",
  meta: "Meta",
  admin: "Administrador",
  lancamento: "Lançamento",
  meta_ajuste: "Ajuste de Meta",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, entity, entity_name, user_nome, user_role, details } = await req.json();

    console.log("[send-audit-alert] Recebido:", { action, entity, entity_name, user_nome });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("[send-audit-alert] RESEND_API_KEY não configurada");
      return new Response(JSON.stringify({ sent: false, reason: "RESEND_API_KEY não configurada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Buscar configurações de alerta
    const { data: settings, error: settingsError } = await supabase
      .from("audit_alert_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.log("[send-audit-alert] Erro ao buscar configurações:", settingsError);
      return new Response(JSON.stringify({ sent: false, reason: "Erro ao buscar configurações" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings?.ativo || !settings.emails?.length) {
      console.log("[send-audit-alert] Alertas desativados ou sem emails configurados");
      return new Response(JSON.stringify({ sent: false, reason: "Alertas desativados" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se a ação está monitorada
    if (!settings.acoes_monitoradas?.includes(action)) {
      console.log("[send-audit-alert] Ação não monitorada:", action);
      return new Response(JSON.stringify({ sent: false, reason: "Ação não monitorada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Montar email de alerta
    const actionLabel = ACTION_LABELS[action] || action;
    const entityLabel = ENTITY_LABELS[entity] || entity;
    const roleLabel = user_role === "admin" ? "Administrador" : "Gerente";
    const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">⚠️ Alerta de Auditoria</h1>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; color: #374151;">Uma ação crítica foi detectada no sistema:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 100px;">Ação</td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #dc2626;">${actionLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tipo</td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${entityLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Entidade</td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${entity_name || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Usuário</td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${user_nome} <span style="color: #6b7280;">(${roleLabel})</span></td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; color: #6b7280;">Data/Hora</td>
                <td style="padding: 10px 8px;">${dataHora}</td>
              </tr>
            </table>
            ${
              details && Object.keys(details).length > 0
                ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280;">
                    <strong>Detalhes:</strong>
                    <pre style="margin: 8px 0 0; white-space: pre-wrap; font-family: monospace; font-size: 11px;">${JSON.stringify(details, null, 2)}</pre>
                  </div>`
                : ""
            }
          </div>
          <div style="padding: 16px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
            Meta Simples - Sistema de Gestão de Metas
          </div>
        </div>
      </body>
      </html>
    `;

    console.log("[send-audit-alert] Enviando para:", settings.emails);

    const { error: emailError } = await resend.emails.send({
      from: "Meta Simples <alertas@metasimplesrelatorios.tecsperts.com>",
      to: settings.emails,
      subject: `⚠️ [ALERTA] ${actionLabel} ${entityLabel}: ${entity_name || "sem nome"}`,
      html,
    });

    if (emailError) {
      console.error("[send-audit-alert] Erro ao enviar email:", emailError);
      return new Response(JSON.stringify({ sent: false, error: emailError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[send-audit-alert] Email enviado com sucesso!");
    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[send-audit-alert] Erro:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
