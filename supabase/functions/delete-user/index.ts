import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!supabaseServiceKey
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Extract JWT from Authorization header and verify it
    const jwt = authHeader.replace('Bearer ', '');
    
    // Get the authenticated user using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user has admin role
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError) {
      console.error('Error checking role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error verifying permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hasAdminRole) {
      console.error('User does not have admin role:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the userId to delete from request body
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user', user.id, 'attempting to delete user', userId);

    // Check if trying to delete master admin
    const MASTER_ADMIN_ID = 'ca936b16-8a15-43f4-976d-6be91e294099';
    
    if (userId === MASTER_ADMIN_ID) {
      console.error('Attempt to delete master admin blocked');
      return new Response(
        JSON.stringify({ error: 'Não é possível deletar o administrador master' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the user using admin client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully deleted user', userId);

    // Limpar referências órfãs nas tabelas de configuração
    console.log('Cleaning orphan references for deleted user', userId);

    // Limpar de whatsapp_cobranca_settings.gerentes_ativos
    const { data: cobrancaSettings } = await supabaseAdmin
      .from('whatsapp_cobranca_settings')
      .select('id, gerentes_ativos')
      .limit(1)
      .maybeSingle();

    if (cobrancaSettings && cobrancaSettings.gerentes_ativos?.includes(userId)) {
      const novoArray = cobrancaSettings.gerentes_ativos.filter((id: string) => id !== userId);
      await supabaseAdmin
        .from('whatsapp_cobranca_settings')
        .update({ gerentes_ativos: novoArray })
        .eq('id', cobrancaSettings.id);
      console.log('Removed user from whatsapp_cobranca_settings.gerentes_ativos');
    }

    // Limpar de whatsapp_report_settings.gerentes_ativos
    const { data: reportSettings } = await supabaseAdmin
      .from('whatsapp_report_settings')
      .select('id, gerentes_ativos')
      .limit(1)
      .maybeSingle();

    if (reportSettings && reportSettings.gerentes_ativos?.includes(userId)) {
      const novoArrayReport = reportSettings.gerentes_ativos.filter((id: string) => id !== userId);
      await supabaseAdmin
        .from('whatsapp_report_settings')
        .update({ gerentes_ativos: novoArrayReport })
        .eq('id', reportSettings.id);
      console.log('Removed user from whatsapp_report_settings.gerentes_ativos');
    }

    // Limpar da tabela sendpulse_contacts
    const { error: deleteContactError } = await supabaseAdmin
      .from('sendpulse_contacts')
      .delete()
      .eq('user_id', userId);
    
    if (deleteContactError) {
      console.warn('Failed to delete sendpulse_contacts entry:', deleteContactError);
    } else {
      console.log('Removed user from sendpulse_contacts');
    }

    console.log('Cleanup completed for deleted user', userId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in delete-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
