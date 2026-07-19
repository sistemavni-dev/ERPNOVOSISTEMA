import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js"

serve(async (req) => {
  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) throw new Error("No DB URL");
    const sql = postgres(dbUrl);
    
    // Fix the trigger function
    await sql`
      CREATE OR REPLACE FUNCTION public.set_tenant_id()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        -- Only override tenant_id if it was not provided in the insert statement
        IF NEW.tenant_id IS NULL THEN
          NEW.tenant_id := auth.uid();
        END IF;
        RETURN NEW;
      END;
      $function$;
    `;

    await sql.end();

    return new Response(JSON.stringify({ success: true, message: "Trigger fixed" }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
})
