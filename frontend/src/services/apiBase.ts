/**
 * Single source of truth for the backend API base URL.
 *
 * Resolution order:
 *
 * 1. `VITE_API_BASE` build-time env var
 *    — set in the Render dashboard, baked into the bundle at build time.
 *    Always preferred if present.
 *
 * 2. Runtime hostname fallback
 *    — if we're served from any `*.onrender.com` host and the build was
 *    shipped without the env var, derive a sensible backend URL.
 *    This rescues the deploy from a forgotten env var: it transforms
 *    `ai-pqa-web.onrender.com`  →  `https://ai-pqa-api.onrender.com`
 *
 * 3. Empty string
 *    — local dev (Vite proxy handles `/api/*`) or unrecognized host.
 *    Calls become same-origin requests.
 *
 * Why this matters: Vite's `import.meta.env.*` values are inlined at
 * `npm run build` time, so an env var added in Render *after* the first
 * deploy doesn't take effect until the static site is rebuilt.  Plenty
 * of users hit that footgun.  The runtime fallback gives us defence in
 * depth: even with a forgotten / stale env var, the production deploy
 * still reaches the production API.
 */

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    // Strip trailing slash so `${BASE}/api/...` never produces `//api/...`
    return fromEnv.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    // Render's free tier subdomains follow `<service>-<id>.onrender.com`.
    // The frontend (`ai-pqa-web`) and backend (`ai-pqa-api`) share the same
    // base — only the leading `web` / `api` differs.  Swap them so a stale
    // frontend bundle still reaches the live backend.
    if (host.endsWith('.onrender.com')) {
      if (host.startsWith('ai-pqa-web')) {
        return 'https://ai-pqa-api.onrender.com'
      }
      // Generic fallback for forks / renamed services that follow the
      // `*-web.onrender.com` convention.
      if (host.includes('-web.')) {
        return `https://${host.replace('-web.', '-api.')}`
      }
    }
  }

  return ''
}

export const API_BASE: string = resolveApiBase()
