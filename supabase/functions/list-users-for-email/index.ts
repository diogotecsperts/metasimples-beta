import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("Fetching users for email...");

    // Buscar todos os usuários com seus roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      throw rolesError;
    }

    console.log("User roles found:", userRoles?.length);

    // Buscar profiles correspondentes
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log("Profiles found:", profiles?.length);

    // Buscar emails dos usuários via auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    console.log("Auth users found:", authUsers?.users?.length);

    // Combinar dados
    const users = userRoles?.map((ur) => {
      const profile = profiles?.find((p) => p.id === ur.user_id);
      const authUser = authUsers?.users?.find((u) => u.id === ur.user_id);

      return {
        id: ur.user_id,
        nome: profile?.nome || authUser?.email || "Usuário",
        email: authUser?.email || "",
        role: ur.role as "admin" | "gerente",
      };
    }).filter((u) => u.email) || [];

    console.log("Combined users:", users.length);

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in list-users-for-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
