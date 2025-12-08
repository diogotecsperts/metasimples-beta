import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const categoriaLabels: Record<string, { label: string; emoji: string; color: string }> = {
  disponivel: { label: "Disponível", emoji: "✅", color: "#10b981" },
  desenvolvimento: { label: "Em Desenvolvimento", emoji: "🔄", color: "#f59e0b" },
  indeterminado: { label: "Indeterminado", emoji: "❓", color: "#6b7280" },
};

interface ChangelogEmailRequest {
  emails: string[];
  item: {
    titulo: string;
    descricao: string;
    categoria: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, item }: ChangelogEmailRequest = await req.json();

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum email fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoria = categoriaLabels[item.categoria] || categoriaLabels.disponivel;

    // Gerar HTML do email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Novidade no Meta Simples</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e3a5f;">
                            ✨ Novidade no Meta simples
                          </h1>
                          <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">
                            Uma nova atualização foi publicada no sistema
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <!-- Badge de categoria -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                      <tr>
                        <td style="background-color: ${categoria.color}15; color: ${categoria.color}; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; border: 1px solid ${categoria.color}30;">
                          ${categoria.emoji} ${categoria.label}
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Título -->
                    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1f2937;">
                      ${item.titulo}
                    </h2>
                    
                    <!-- Descrição -->
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #4b5563; white-space: pre-wrap; text-align: justify;">
                      ${item.descricao}
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                      Enviado pelo Meta Simples • Sistema de Gestão de Metas
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    console.log(`[send-changelog-email] Enviando para ${emails.length} destinatários:`, emails);

    // Enviar email para todos os destinatários
    const emailResponse = await resend.emails.send({
      from: "Meta Simples <novidades@metasimplesrelatorios.tecsperts.com>",
      to: emails,
      subject: `✨ Novidade: ${item.titulo}`,
      html,
    });

    console.log("[send-changelog-email] Resposta do Resend:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-changelog-email] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
