export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Key',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const authKey = request.headers.get('X-Auth-Key')
      if (!authKey || authKey !== env.AUTH_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      const body = await request.json()
      const { action } = body

      await env.DB.exec(
        'CREATE TABLE IF NOT EXISTS app_sync (id INTEGER PRIMARY KEY, data TEXT, updated_at TEXT)'
      )

      if (action === 'push') {
        const now = new Date().toISOString()
        await env.DB.prepare(
          'INSERT OR REPLACE INTO app_sync (id, data, updated_at) VALUES (1, ?, ?)'
        ).bind(JSON.stringify(body.data), now).run()

        return new Response(JSON.stringify({ ok: true, updated_at: now }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      if (action === 'pull') {
        const result = await env.DB.prepare(
          'SELECT data, updated_at FROM app_sync WHERE id = 1'
        ).first()

        return new Response(JSON.stringify({
          ok: true,
          data: result ? JSON.parse(result.data) : null,
          updated_at: result ? result.updated_at : null,
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }

      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
  },
}
