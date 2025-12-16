import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time in Brazil timezone (UTC-3)
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    const horaAtual = nowBrasil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    console.log(`[check-manual-reports] Verificando horário: ${horaAtual}`);

    // Fetch report settings
    const { data: settings, error: settingsError } = await supabase
      .from("report_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[check-manual-reports] Erro ao buscar configurações:", settingsError);
      throw new Error("Erro ao buscar configurações de relatório");
    }

    if (!settings) {
      console.log("[check-manual-reports] Nenhuma configuração encontrada");
      return new Response(
        JSON.stringify({ success: false, message: "Configurações não encontradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if manual mode is active
    if (settings.modo !== 'manual') {
      console.log("[check-manual-reports] Modo automático ativo, ignorando verificação manual");
      return new Response(
        JSON.stringify({ success: false, message: "Modo automático ativo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if reports are active
    if (!settings.ativo) {
      console.log("[check-manual-reports] Relatórios desativados");
      return new Response(
        JSON.stringify({ success: false, message: "Relatórios desativados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if current time matches any manual schedule
    const horariosManuais = settings.horarios_manuais || [];
    
    if (!horariosManuais.includes(horaAtual)) {
      console.log(`[check-manual-reports] Horário ${horaAtual} não está nos horários manuais: ${horariosManuais.join(', ')}`);
      return new Response(
        JSON.stringify({ success: false, message: "Horário não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-manual-reports] Horário ${horaAtual} encontrado! Chamando send-report...`);

    // Call send-report edge function
    const sendReportResponse = await fetch(`${supabaseUrl}/functions/v1/send-report`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ horario: horaAtual, isTest: false, isManual: true }),
    });

    const sendReportData = await sendReportResponse.json();
    console.log("[check-manual-reports] Resposta do send-report:", sendReportData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Relatório manual disparado para ${horaAtual}`,
        sendReportResponse: sendReportData 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[check-manual-reports] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
