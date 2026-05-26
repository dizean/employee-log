import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { password } = await req.json();

    // get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    // 1. update password
    const { error: passErr } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password,
      }
    );

    if (passErr) {
      return new Response(JSON.stringify({ error: passErr.message }), {
        status: 400,
      });
    }

    // 2. set admin role (SECURE)
    const { error: metaErr } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          role: "admin",
        },
      }
    );

    if (metaErr) {
      return new Response(JSON.stringify({ error: metaErr.message }), {
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password set + role assigned",
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});