import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("sessionId") || "").slice(0, 128);
    const conversationId = url.searchParams.get("conversationId");
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

    if (conversationId) {
      // Verify ownership and return messages
      const { data: convo } = await sb
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!convo) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: messages } = await sb
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      return new Response(JSON.stringify({ conversation: convo, messages: messages ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await sb
      .from("conversations")
      .select("id, title, disease, patient_name, location, created_at, updated_at")
      .eq("session_id", sessionId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return new Response(JSON.stringify({ conversations: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-conversations error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
