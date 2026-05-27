import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const THRESHOLD = 0.45;

function euclideanDistance(a: number[], b: number[]) {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }

  return Math.sqrt(sum);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const {
      name,
      role,
      descriptor,
      image_base64,
    } = await req.json();

    if (!name || !descriptor) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 🔴 STEP 1: GET ALL EXISTING FACE DESCRIPTORS
    const { data: faces, error: faceFetchError } = await supabase
      .from("employee_faces")
      .select("employee_id, descriptor");

    if (faceFetchError) {
      return new Response(
        JSON.stringify({ error: faceFetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 🔴 STEP 2: COMPARE FACE SIMILARITY
    const incoming = descriptor as number[];

    for (const face of faces || []) {
      const stored = face.descriptor as number[];

      const distance = euclideanDistance(incoming, stored);

      if (distance < THRESHOLD) {
        return new Response(
          JSON.stringify({
            error: "Face already exists",
            duplicate: true,
            match_employee_id: face.employee_id,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .insert({
        name,
        role,
      })
      .select()
      .single();

    if (empError) {
      return new Response(
        JSON.stringify({ error: empError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let imageUrl = null;

    if (image_base64) {
      const fileName = `${employee.id}-${Date.now()}.jpg`;

      const buffer = Uint8Array.from(
        atob(image_base64.split(",")[1]),
        (c) => c.charCodeAt(0)
      );

      await supabase.storage
        .from("employee-images")
        .upload(fileName, buffer, {
          contentType: "image/jpeg",
        });

      const { data } = supabase.storage
        .from("employee-images")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    await supabase
      .from("employees")
      .update({ image_url: imageUrl })
      .eq("id", employee.id);

    const { error: insertFaceError } = await supabase
      .from("employee_faces")
      .insert({
        employee_id: employee.id,
        descriptor,
      });

    if (insertFaceError) {
      return new Response(
        JSON.stringify({ error: insertFaceError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        employee,
        image_url: imageUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});