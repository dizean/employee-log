import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { descriptor, gate } = body;

    if (!descriptor) {
      return new Response(
        JSON.stringify({ error: "Missing descriptor" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: employees, error: empErr } = await supabase
      .from("employee_faces")
      .select(`
    employee_id,
    employees(name)
  `);

    if (empErr) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch employees",
          details: empErr.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let matchedEmployeeId: string | null = null;

    for (const emp of employees || []) {
      const distance = Math.random();

      if (distance < 0.5) {
        matchedEmployeeId = emp.employee_id;
        break;
      }
    }

    if (!matchedEmployeeId) {
      return new Response(
        JSON.stringify({
          matched: false,
          message: "No match found",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: logs } = await supabase
      .from("employee_logs")
      .select("*")
      .eq("employee_id", matchedEmployeeId)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .order("created_at", { ascending: false });

    const lastLog = logs?.[0];


    let actionToInsert = "IN";

    if (!lastLog) {
      actionToInsert = "IN";
    } else if (lastLog.action === "IN") {
      actionToInsert = "OUT";
    } else {
      return new Response(
        JSON.stringify({
          matched: true,
          action: "BLOCKED",
          employee_id: matchedEmployeeId,
          message: "Already completed IN & OUT for today",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { error: insertError } = await supabase.from("employee_logs").insert({
      employee_id: matchedEmployeeId,
      gate,
      action: actionToInsert,
    });

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: "Failed to insert log",
          details: insertError.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        matched: true,
        employee_id: matchedEmployeeId,
        employee_name: employee.name,
        action: actionToInsert,
        message: `${actionToInsert} logged successfully`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || "Server error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});