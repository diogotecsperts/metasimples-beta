import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CobrancaSettings {
  id: string;
  ativo: boolean;
  tolerancia_minutos: number;
  intervalos_cobranca: string[];
  gerentes_ativos: string[];
  horarios_monitorados: string[];
}

interface Gerente {
  id: string;
  nome: string;
  telefone: string;
  loja_id: string;
}

interface Loja {
  id: string;
  nome: string;
  tipo_operacional: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time in Brazil timezone
    const now = new Date();
    const brasilOffsetMs = -3 * 60 * 60 * 1000;
    const nowBrasil = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + brasilOffsetMs);
    
    const horaAtual = nowBrasil.getHours();
    const minutoAtual = nowBrasil.getMinutes();
    const horaMinuto = `${horaAtual.toString().padStart(2, '0')}:${minutoAtual.toString().padStart(2, '0')}`;
    const todayStr = nowBrasil.toISOString().split('T')[0];
    const diaSemana = nowBrasil.getDay(); // 0 = domingo

    console.log(`[check-pending-lancamentos] Verificando às ${horaMinuto}, data: ${todayStr}, dia: ${diaSemana}`);

    // Buscar configurações do sistema de cobrança
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_cobranca_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[check-pending-lancamentos] Erro ao buscar configurações:", settingsError);
      throw new Error("Erro ao buscar configurações");
    }

    if (!settings || !settings.ativo) {
      console.log("[check-pending-lancamentos] Sistema de cobrança desativado ou não configurado");
      return new Response(
        JSON.stringify({ success: true, message: "Sistema desativado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = settings as CobrancaSettings;
    
    if (!config.gerentes_ativos || config.gerentes_ativos.length === 0) {
      console.log("[check-pending-lancamentos] Nenhum gerente configurado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum gerente configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Para cada horário monitorado, verificar se o horário atual corresponde a algum intervalo de cobrança
    const cobrancasEnviadas: string[] = [];

    for (const horarioLancamento of config.horarios_monitorados) {
      const [horaLanc, minLanc] = horarioLancamento.split(':').map(Number);
      
      // Calcular minutos desde o horário de lançamento
      const minutosDesdeLancamento = (horaAtual * 60 + minutoAtual) - (horaLanc * 60 + minLanc);
      
      // Ignorar se ainda não chegou no horário de lançamento
      if (minutosDesdeLancamento < 0) continue;
      
      // Verificar se corresponde a algum intervalo de cobrança
      for (let nivelIdx = 0; nivelIdx < config.intervalos_cobranca.length; nivelIdx++) {
        const intervaloStr = config.intervalos_cobranca[nivelIdx];
        const intervaloMinutos = parseInt(intervaloStr) + config.tolerancia_minutos;
        const nivelCobranca = nivelIdx + 1;
        
        // Verificar se estamos exatamente no minuto da cobrança (+/- 1 minuto de tolerância)
        if (Math.abs(minutosDesdeLancamento - intervaloMinutos) <= 1) {
          console.log(`[check-pending-lancamentos] Horário ${horarioLancamento}: intervalo ${intervaloMinutos}min (nível ${nivelCobranca}) atingido`);
          
          // Buscar gerentes ativos com suas lojas
          const { data: gerentes, error: gerentesError } = await supabase
            .from("profiles")
            .select("id, nome, telefone, loja_id")
            .in("id", config.gerentes_ativos);

          if (gerentesError) {
            console.error("[check-pending-lancamentos] Erro ao buscar gerentes:", gerentesError);
            continue;
          }

          // Filtrar gerentes com telefone válido e loja
          const gerentesValidos = (gerentes || []).filter(g => g.telefone && g.loja_id) as Gerente[];
          
          if (gerentesValidos.length === 0) {
            console.log("[check-pending-lancamentos] Nenhum gerente válido encontrado");
            continue;
          }

          // Buscar lojas para verificar tipo operacional (lojas tipo B não operam domingo)
          const lojaIds = gerentesValidos.map(g => g.loja_id);
          const { data: lojas, error: lojasError } = await supabase
            .from("lojas")
            .select("id, nome, tipo_operacional")
            .in("id", lojaIds);

          if (lojasError) {
            console.error("[check-pending-lancamentos] Erro ao buscar lojas:", lojasError);
            continue;
          }

          const lojasMap = new Map<string, Loja>();
          (lojas || []).forEach((l: Loja) => lojasMap.set(l.id, l));

          // Buscar lançamentos do dia para verificar quem já preencheu
          const { data: lancamentos, error: lancamentosError } = await supabase
            .from("lancamentos_diarios")
            .select("loja_id")
            .eq("data", todayStr)
            .eq("horario", horarioLancamento);

          if (lancamentosError) {
            console.error("[check-pending-lancamentos] Erro ao buscar lançamentos:", lancamentosError);
            continue;
          }

          const lojasPreenchidas = new Set((lancamentos || []).map(l => l.loja_id));
          console.log(`[check-pending-lancamentos] Lojas que já preencheram ${horarioLancamento}:`, lojasPreenchidas.size);

          // Buscar logs de cobrança já enviadas para não duplicar
          const { data: logsExistentes, error: logsError } = await supabase
            .from("whatsapp_cobranca_log")
            .select("gerente_id, nivel_cobranca")
            .eq("data", todayStr)
            .eq("horario_lancamento", horarioLancamento)
            .eq("nivel_cobranca", nivelCobranca);

          if (logsError) {
            console.error("[check-pending-lancamentos] Erro ao buscar logs:", logsError);
            continue;
          }

          const gerentesJaCobrados = new Set((logsExistentes || []).map(l => l.gerente_id));

          // Para cada gerente, verificar se precisa enviar cobrança
          for (const gerente of gerentesValidos) {
            const loja = lojasMap.get(gerente.loja_id);
            
            // Verificar se loja tipo B em domingo (não opera)
            if (loja && loja.tipo_operacional === 'B' && diaSemana === 0) {
              console.log(`[check-pending-lancamentos] ${gerente.nome}: loja ${loja.nome} tipo B não opera domingo`);
              continue;
            }

            // Verificar se já preencheu
            if (lojasPreenchidas.has(gerente.loja_id)) {
              console.log(`[check-pending-lancamentos] ${gerente.nome}: já preencheu ${horarioLancamento}`);
              continue;
            }

            // Verificar se já foi cobrado neste nível
            if (gerentesJaCobrados.has(gerente.id)) {
              console.log(`[check-pending-lancamentos] ${gerente.nome}: já cobrado nível ${nivelCobranca} para ${horarioLancamento}`);
              continue;
            }

            // Enviar cobrança!
            console.log(`[check-pending-lancamentos] Enviando cobrança nível ${nivelCobranca} para ${gerente.nome} (${horarioLancamento})`);
            
            try {
              const { data: sendResult, error: sendError } = await supabase.functions.invoke("send-whatsapp-cobranca", {
                body: {
                  gerenteId: gerente.id,
                  lojaId: gerente.loja_id,
                  horarioLancamento: horarioLancamento,
                  nivelCobranca: nivelCobranca,
                  minutosAtraso: intervaloMinutos
                }
              });

              if (sendError) {
                console.error(`[check-pending-lancamentos] Erro ao enviar cobrança para ${gerente.nome}:`, sendError);
              } else {
                console.log(`[check-pending-lancamentos] Cobrança enviada para ${gerente.nome}:`, sendResult);
                cobrancasEnviadas.push(`${gerente.nome} (nível ${nivelCobranca})`);
              }
            } catch (e) {
              console.error(`[check-pending-lancamentos] Exceção ao enviar cobrança para ${gerente.nome}:`, e);
            }
          }
        }
      }
    }

    const message = cobrancasEnviadas.length > 0 
      ? `${cobrancasEnviadas.length} cobrança(s) enviada(s): ${cobrancasEnviadas.join(', ')}`
      : `Nenhuma cobrança necessária às ${horaMinuto}`;

    console.log(`[check-pending-lancamentos] ${message}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        horario: horaMinuto,
        cobrancasEnviadas
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[check-pending-lancamentos] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
