import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const { action, tenant_id } = await req.json()
    if (!action || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    // JWT Validation Client
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (!user || user.id !== tenant_id) {
      return new Response(JSON.stringify({ 
        error: `Unauthorized`, 
        details: authError?.message || `User ID mismatch: ${user?.id} vs ${tenant_id}`
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const apiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '')
    const apiKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!apiUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const instanceName = `tenant_${tenant_id.replace(/-/g, '')}`

    if (action === 'get-qr-code') {
      // 1. Update DB to connecting
      await supabaseClient.from('tenants').update({
        whatsapp_instance_name: instanceName,
        whatsapp_status: 'connecting'
      }).eq('id', tenant_id)

      // 2. Try to fetch connection/QR code
      let connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { 
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}` // Some Evolution API versions accept Bearer
        }
      })

      // If instance does not exist, create it (Evolution usually returns 404 if not found)
      // If Evolution API returns 401/403, it's an API Key error, we should NOT return 401 to the frontend to avoid logging the user out.
      if (connectRes.status === 404 || connectRes.status === 400 || connectRes.status === 403 || connectRes.status === 401) {
        
        // Let's attempt to create it. If it was a 401/403, this will also fail, but we'll catch it below.
        const createRes = await fetch(`${apiUrl}/instance/create`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            instanceName,
            token: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        })
        
        if (!createRes.ok) {
          const err = await createRes.text()
          // Return 500 instead of 401 to prevent frontend from thinking the USER is unauthorized
          return new Response(JSON.stringify({ error: "Failed to create instance in Evolution API", details: err, status: createRes.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }
        
        const createData = await createRes.json()
        if (createData.qrcode && createData.qrcode.base64) {
          return new Response(JSON.stringify({ success: true, base64: createData.qrcode.base64 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        } else if (createData.base64) {
          return new Response(JSON.stringify({ success: true, base64: createData.base64 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Fetch connect again after creation if it wasn't returned
        connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: { 
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`
          }
        })
      }

      if (!connectRes.ok) {
        const err = await connectRes.text()
        return new Response(JSON.stringify({ error: "Failed to connect instance", details: err }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const connectData = await connectRes.json()
      // Connect data usually has { base64: "..." }
      if (connectData.base64) {
        return new Response(JSON.stringify({ success: true, base64: connectData.base64 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      } else {
        return new Response(JSON.stringify({ success: true, data: connectData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
    }

    if (action === 'check-status') {
      const stateRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: { 
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!stateRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch state from Evolution API" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const stateData = await stateRes.json()
      const state = stateData?.instance?.state || stateData?.state || 'disconnected'

      if (state === 'open') {
        await supabaseClient.from('tenants').update({ whatsapp_status: 'connected' }).eq('id', tenant_id)
      } else if (state === 'close') {
        await supabaseClient.from('tenants').update({ whatsapp_status: 'disconnected' }).eq('id', tenant_id)
      }

      return new Response(JSON.stringify({ success: true, state }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("Error in whatsapp-manager:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
