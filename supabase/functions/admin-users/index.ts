// Edge Function Supabase : administration des comptes utilisateurs.
// La clé `service_role` n'est jamais exposée au client ; cette fonction vérifie
// que l'appelant est authentifié ET administrateur avant d'agir.
//
// Déploiement : supabase functions deploy admin-users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ error: 'Non authentifié' }, 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
      return json({ error: 'Réservé aux administrateurs' }, 403);
    }

    const body = await req.json();

    if (body.action === 'create') {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
        data: { full_name: body.fullName, role: body.role ?? 'employee' },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ user: data.user }, 201);
    }

    if (body.action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
