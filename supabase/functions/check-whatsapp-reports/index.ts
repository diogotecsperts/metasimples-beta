import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time in Brazil timezone
    const nowBrasil = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const horaAtual = nowBrasil.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });

    console.log(`[check-whatsapp-reports] Verificando horário: ${horaAtual}`);

    // Fetch whatsapp_report_settings
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_report_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[check-whatsapp-reports] Erro ao buscar settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings) {
      console.log("[check-whatsapp-reports] Nenhuma configuração encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma configuração encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.ativo) {
      console.log("[check-whatsapp-reports] Relatórios WhatsApp desativados");
      return new Response(
        JSON.stringify({ message: "Relatórios WhatsApp desativados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const horariosAtivos = settings.horarios_ativos || [];
    console.log(`[check-whatsapp-reports] Horários ativos: ${horariosAtivos.join(", ")}`);

    if (!horariosAtivos.includes(horaAtual)) {
      console.log(`[check-whatsapp-reports] Horário ${horaAtual} não está nos horários ativos`);
      return new Response(
        JSON.stringify({ message: `Horário ${horaAtual} não está configurado para envio` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Horário corresponde - chamar send-whatsapp-report
    console.log(`[check-whatsapp-reports] ✅ Horário ${horaAtual} corresponde! Chamando send-whatsapp-report...`);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ 
        horario: horaAtual, 
        isTest: false,
        triggeredBy: "check-whatsapp-reports"
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error(`[check-whatsapp-reports] Erro ao chamar send-whatsapp-report:`, result);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar relatório", details: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-whatsapp-reports] ✅ Relatório enviado com sucesso:`, result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Relatório WhatsApp enviado às ${horaAtual}`,
        result 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[check-whatsapp-reports] Erro inesperado:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
