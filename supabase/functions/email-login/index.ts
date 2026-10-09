// Email-only sign-in: anyone who types an email gets a session for that email.
// No password and nothing is emailed. Creates the account on first use.
//
// Returns a one-time token hash; the app exchanges it with
// supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) for a normal session,
// so row-level security still applies per user.
//
// Deployed with verify_jwt = false because callers aren't signed in yet.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let email = ''
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    /* fall through to validation */
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Enter a valid email address.' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // First time: create the account (already confirmed, so no email goes out).
  const created = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (created.error) {
    const alreadyExists =
      created.error.code === 'email_exists' || /already (been )?registered|already exists/i.test(created.error.message)
    if (!alreadyExists) return json({ error: created.error.message }, 500)
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) {
    return json({ error: link.error?.message ?? 'Could not sign in. Try again.' }, 500)
  }

  return json({ token_hash: tokenHash, new_account: !created.error })
})
