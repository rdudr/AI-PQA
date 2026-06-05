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

// Known production backend URL.  Hardcoded as a last-resort fallback so
// the deploy always reaches the right host even if the env var was forgotten
// AND the frontend service was renamed on Render.
const PRODUCTION_API = 'https://ai-pqa-api.onrender.com'

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname

    // Local dev — same-origin so Vite's proxy can intercept /api/*
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return ''
    }

    // Render hostname conventions: try `*-web.onrender.com` -> `*-api.onrender.com`
    // swap first; if it doesn't match the convention, fall through to the
    // hard-coded production URL.
    if (host.endsWith('.onrender.com')) {
      // 1. Convention: -web -> -api (handles suffixes like -web-y5gq)
      if (host.includes('-web')) {
        return `https://${host.replace('-web', '-api')}`
      }
      // 2. Convention: -frontend -> -backend
      if (host.includes('-frontend')) {
        return `https://${host.replace('-frontend', '-backend')}`
      }
      // Any other onrender.com host (custom service names, preview URLs, etc.)
      // defaults to the documented production backend.
      return PRODUCTION_API
    }

    // Anything else (custom domains in front of Render, alt hosts) also
    // defaults to the production backend.  Safer than letting the call hit
    // the frontend's own domain and getting index.html back.
    return PRODUCTION_API
  }

  return ''
}

export const API_BASE: string = resolveApiBase()

// Surface the resolved API base in the console at boot so deploy-vs-runtime
// mismatches are immediately diagnosable from DevTools.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info(`[PQ] API base resolved → ${API_BASE || '(same origin)'}`)
}
