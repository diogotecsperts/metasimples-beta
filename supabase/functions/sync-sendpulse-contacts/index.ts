import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  id: string;
  nome: string;
  telefone: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface SendPulseContact {
  id: string;
  status: number;
  phone: string;
  name?: string;
}

interface SyncResult {
  userId: string;
  nome: string;
  telefone: string;
  status: 'ativo' | 'bloqueado' | 'nao_existe' | 'pendente';
  contactId?: string;
  action: 'criado' | 'atualizado' | 'sem_mudanca' | 'erro';
  error?: string;
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("[sync-sendpulse-contacts] Obtendo access token do SendPulse...");
  
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
    console.error("[sync-sendpulse-contacts] Erro ao obter token:", response.status, errorText);
    throw new Error(`Erro ao obter token SendPulse: ${response.status}`);
  }

  const data = await response.json();
  console.log("[sync-sendpulse-contacts] Token obtido com sucesso");
  return data.access_token;
}

// Busca contato pelo telefone no SendPulse
async function getContactByPhone(
  accessToken: string,
  botId: string,
  phone: string
): Promise<SendPulseContact | null> {
  console.log(`[sync-sendpulse-contacts] Buscando contato pelo telefone ${phone}...`);
  
  const url = `https://api.sendpulse.com/whatsapp/contacts/getByPhone?bot_id=${botId}&phone=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  const responseText = await response.text();
  console.log(`[sync-sendpulse-contacts] Resposta getContactByPhone:`, response.status, responseText);

  if (!response.ok) {
    console.log(`[sync-sendpulse-contacts] Contato não encontrado para ${phone}`);
    return null;
  }

  try {
    const data = JSON.parse(responseText);
    if (data.success && data.data) {
      console.log(`[sync-sendpulse-contacts] Contato encontrado: id=${data.data.id}, status=${data.data.status}`);
      return {
        id: data.data.id,
        status: data.data.status,
        phone: data.data.phone || phone,
        name: data.data.name
      };
    }
  } catch (e) {
    console.error(`[sync-sendpulse-contacts] Erro ao parsear resposta:`, e);
  }

  return null;
}

// Determinar status baseado no status do SendPulse
function mapSendPulseStatus(status: number): 'ativo' | 'bloqueado' | 'pendente' {
  // Status SendPulse: 1=ativo, 4=banido
  switch (status) {
    case 1:
      return 'ativo';
    case 4:
      return 'bloqueado';
    default:
      return 'pendente';
  }
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
      console.error("[sync-sendpulse-contacts] Secrets do SendPulse não configurados");
      return new Response(
        JSON.stringify({ success: false, error: "Secrets do SendPulse não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional filters from request
    const body = await req.json().catch(() => ({}));
    const { userIds, userType } = body;

    console.log(`[sync-sendpulse-contacts] Iniciando sincronização...`, { userIds, userType });

    // Get SendPulse access token
    const accessToken = await getAccessToken(sendpulseClientId, sendpulseClientSecret);

    // Buscar todos os usuários com telefone
    let profilesQuery = supabase
      .from("profiles")
      .select("id, nome, telefone")
      .not("telefone", "is", null);

    if (userIds && userIds.length > 0) {
      profilesQuery = profilesQuery.in("id", userIds);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error("[sync-sendpulse-contacts] Erro ao buscar profiles:", profilesError);
      throw new Error("Erro ao buscar profiles");
    }

    // Buscar roles para determinar user_type
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("[sync-sendpulse-contacts] Erro ao buscar roles:", rolesError);
    }

    const rolesMap = new Map<string, string>();
    (roles || []).forEach((r: UserRole) => {
      rolesMap.set(r.user_id, r.role);
    });

    // Filtrar por userType se especificado
    let filteredProfiles = (profiles || []) as Profile[];
    if (userType) {
      filteredProfiles = filteredProfiles.filter(p => {
        const role = rolesMap.get(p.id);
        return role === userType;
      });
    }

    console.log(`[sync-sendpulse-contacts] ${filteredProfiles.length} profiles para sincronizar`);

    const results: SyncResult[] = [];

    for (const profile of filteredProfiles) {
      if (!profile.telefone) {
        continue;
      }

      const normalizedPhone = normalizePhoneNumber(profile.telefone);
      const role = rolesMap.get(profile.id) || 'gerente';
      const userTypeValue = role === 'admin' ? 'admin' : 'gerente';

      try {
        // Buscar contato no SendPulse
        const sendpulseContact = await getContactByPhone(accessToken, sendpulseBotId, normalizedPhone);

        let status: 'ativo' | 'bloqueado' | 'nao_existe' | 'pendente';
        let contactId: string | undefined;

        if (sendpulseContact) {
          status = mapSendPulseStatus(sendpulseContact.status);
          contactId = sendpulseContact.id;
        } else {
          status = 'nao_existe';
        }

        // Verificar se já existe registro no banco
        const { data: existingContact } = await supabase
          .from("sendpulse_contacts")
          .select("*")
          .eq("user_id", profile.id)
          .maybeSingle();

        if (existingContact) {
          // Atualizar se houve mudança
          const hasChanges = 
            existingContact.status !== status ||
            existingContact.sendpulse_contact_id !== contactId ||
            existingContact.telefone !== normalizedPhone;

          if (hasChanges) {
            const updateData: Record<string, unknown> = {
              status,
              telefone: normalizedPhone,
              user_type: userTypeValue,
            };

            if (contactId) {
              updateData.sendpulse_contact_id = contactId;
            }

            if (status === 'bloqueado' && existingContact.status !== 'bloqueado') {
              updateData.ultimo_bloqueio_at = new Date().toISOString();
            }

            if (status === 'ativo' && existingContact.status !== 'ativo') {
              updateData.opt_in_at = new Date().toISOString();
            }

            await supabase
              .from("sendpulse_contacts")
              .update(updateData)
              .eq("id", existingContact.id);

            results.push({
              userId: profile.id,
              nome: profile.nome,
              telefone: normalizedPhone,
              status,
              contactId,
              action: 'atualizado'
            });
          } else {
            results.push({
              userId: profile.id,
              nome: profile.nome,
              telefone: normalizedPhone,
              status,
              contactId,
              action: 'sem_mudanca'
            });
          }
        } else {
          // Criar novo registro
          await supabase
            .from("sendpulse_contacts")
            .insert({
              user_id: profile.id,
              user_type: userTypeValue,
              telefone: normalizedPhone,
              sendpulse_contact_id: contactId || null,
              status,
              opt_in_at: status === 'ativo' ? new Date().toISOString() : null,
              ultimo_bloqueio_at: status === 'bloqueado' ? new Date().toISOString() : null,
            });

          results.push({
            userId: profile.id,
            nome: profile.nome,
            telefone: normalizedPhone,
            status,
            contactId,
            action: 'criado'
          });
        }

        // Delay para não sobrecarregar a API do SendPulse
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`[sync-sendpulse-contacts] Erro ao processar ${profile.nome}:`, error);
        results.push({
          userId: profile.id,
          nome: profile.nome,
          telefone: normalizePhoneNumber(profile.telefone),
          status: 'pendente',
          action: 'erro',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Resumo
    const criados = results.filter(r => r.action === 'criado').length;
    const atualizados = results.filter(r => r.action === 'atualizado').length;
    const semMudanca = results.filter(r => r.action === 'sem_mudanca').length;
    const erros = results.filter(r => r.action === 'erro').length;

    console.log(`[sync-sendpulse-contacts] Concluído: ${criados} criados, ${atualizados} atualizados, ${semMudanca} sem mudança, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${criados} criados, ${atualizados} atualizados, ${erros} erros`,
        results,
        summary: {
          total: results.length,
          criados,
          atualizados,
          semMudanca,
          erros
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-sendpulse-contacts] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
