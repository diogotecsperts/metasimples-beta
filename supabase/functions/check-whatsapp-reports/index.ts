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

    // Verificar se o horário atual está dentro de uma janela de ±2 minutos de algum horário configurado
    const isHorarioMatch = (horaCheck: string): boolean => {
      // Verificação exata primeiro
      if (horariosAtivos.includes(horaCheck)) return true;
      
      // Verificar com tolerância de ±2 minutos
      const [horaCheckH, horaCheckM] = horaCheck.split(":").map(Number);
      const checkMinutes = horaCheckH * 60 + horaCheckM;
      
      for (const horarioAtivo of horariosAtivos) {
        const [h, m] = horarioAtivo.split(":").map(Number);
        const ativoMinutes = h * 60 + m;
        const diff = Math.abs(checkMinutes - ativoMinutes);
        
        // Tolerância de 2 minutos
        if (diff <= 2 || diff >= (24 * 60 - 2)) {
          console.log(`[check-whatsapp-reports] Horário ${horaCheck} corresponde a ${horarioAtivo} (tolerância ±2min)`);
          return true;
        }
      }
      return false;
    };

    // Encontrar o horário configurado mais próximo para logging
    const getHorarioCorrespondente = (): string | null => {
      if (horariosAtivos.includes(horaAtual)) return horaAtual;
      
      const [horaCheckH, horaCheckM] = horaAtual.split(":").map(Number);
      const checkMinutes = horaCheckH * 60 + horaCheckM;
      
      for (const horarioAtivo of horariosAtivos) {
        const [h, m] = horarioAtivo.split(":").map(Number);
        const ativoMinutes = h * 60 + m;
        const diff = Math.abs(checkMinutes - ativoMinutes);
        
        if (diff <= 2 || diff >= (24 * 60 - 2)) {
          return horarioAtivo;
        }
      }
      return null;
    };

    if (!isHorarioMatch(horaAtual)) {
      console.log(`[check-whatsapp-reports] Horário ${horaAtual} não está nos horários ativos`);
      return new Response(
        JSON.stringify({ message: `Horário ${horaAtual} não está configurado para envio` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const horarioCorrespondente = getHorarioCorrespondente();

    // Verificar se já foi enviado para este horário hoje (evitar duplicatas com a tolerância)
    const dataHoje = nowBrasil.toISOString().split('T')[0];
    const horarioParaVerificar = horarioCorrespondente || horaAtual;
    
    const { data: enviosExistentes, error: enviosError } = await supabase
      .from("whatsapp_report_log")
      .select("id")
      .eq("data", dataHoje)
      .eq("horario_envio", horarioParaVerificar)
      .eq("is_test", false)
      .limit(1);

    if (enviosError) {
      console.error("[check-whatsapp-reports] Erro ao verificar envios anteriores:", enviosError);
    } else if (enviosExistentes && enviosExistentes.length > 0) {
      console.log(`[check-whatsapp-reports] ⚠️ Relatório para ${horarioParaVerificar} já foi enviado hoje. Ignorando.`);
      return new Response(
        JSON.stringify({ message: `Relatório para ${horarioParaVerificar} já enviado hoje`, skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Horário corresponde - chamar send-whatsapp-report
    console.log(`[check-whatsapp-reports] ✅ Horário ${horaAtual} corresponde a ${horarioCorrespondente}! Chamando send-whatsapp-report...`);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ 
        horario: horarioCorrespondente || horaAtual, 
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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[check-whatsapp-reports] Erro inesperado:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
