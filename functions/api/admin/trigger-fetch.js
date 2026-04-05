/**
 * POST /api/admin/trigger-fetch
 * Trigger the GitHub Actions "Fetch Channel Transcripts" workflow.
 * Cloudflare Worker IPs are blocked by YouTube; GitHub Actions IPs are not.
 *
 * Body: { channelId?: string, limit?: number }
 * Env:  GITHUB_TOKEN  — fine-grained PAT with Actions: read+write scope
 */

const REPO = 'Jia-Hong-Peng/jolike.com'
const WORKFLOW = 'fetch-transcripts.yml'

export async function onRequestPost(context) {
  const { request, env } = context

  const token = env.GITHUB_TOKEN
  if (!token) {
    return json({ error: 'NOT_CONFIGURED', message: 'GITHUB_TOKEN 未設定，請至 Cloudflare Pages 環境變數新增' }, 500)
  }

  let body = {}
  try { body = await request.json() } catch { /* empty body ok */ }
  const { channelId, limit = 500 } = body

  const inputs = { limit: String(limit) }
  if (channelId) inputs.channel = channelId

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'jolike.com',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    }
  )

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    return json({ error: 'GITHUB_ERROR', message: `GitHub API 回應 ${res.status}: ${msg}` }, res.status)
  }

  return json({
    triggered: true,
    channelId: channelId || null,
    runsUrl: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`,
  })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
