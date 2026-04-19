import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 128);
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await sb
      .from("conversations")
      .insert({
        session_id: sessionId,
        title: String(body.title || "New conversation").slice(0, 200),
        patient_name: body.patientName ? String(body.patientName).slice(0, 200) : null,
        disease: body.disease ? String(body.disease).slice(0, 200) : null,
        location: body.location ? String(body.location).slice(0, 200) : null,
      })
      .select()
      .single();

    if (error) throw error;
    return new Response(JSON.stringify({ conversation: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("new-conversation error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
