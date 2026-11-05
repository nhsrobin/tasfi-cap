/**
 * Universal Multi-Frontend API Configuration for Tasfi AI
 * 
 * Central Render Backend URL:
 * https://tasfi.onrender.com
 * 
 * Smart Resolution:
 * 1. Render Deployment (tasfi.onrender.com): Uses relative '' for zero-latency local routing.
 * 2. Vercel Deployment (*.vercel.app): Automatically targets https://tasfi.onrender.com
 * 3. Capacitor Native Android/iOS: Automatically targets https://tasfi.onrender.com
 * 4. Local Dev / Cloud Preview: Uses relative '' for the local backend.
 * 5. Environment Variable Override: If VITE_API_URL is explicitly set, it takes precedence.
 */

export const CENTRAL_RENDER_BACKEND = "https://tasfi.onrender.com";

export function getResolvedBaseUrl(): string {
  // 1. Explicit env var override (if user sets VITE_API_URL in .env or dashboard)
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Client-side Smart Environment Detection
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const href = window.location.href;

    // A. Capacitor / Ionic Android Native App Environment
    // Native apps load assets locally from capacitor://localhost or http://localhost
    if (protocol === 'capacitor:' || protocol === 'ionic:' || href.startsWith('capacitor://')) {
      return CENTRAL_RENDER_BACKEND;
    }

    // B. Vercel Web Deployment (*.vercel.app or custom Vercel domain)
    if (hostname.includes('vercel.app')) {
      return CENTRAL_RENDER_BACKEND;
    }

    // C. Hosted directly on Render (both frontend and backend together)
    // Uses relative paths ('') for direct zero-latency in-memory routing
    if (hostname.includes('onrender.com') || hostname === 'tasfi.onrender.com') {
      return '';
    }

    // D. Localhost or Cloud Dev Environment
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('run.app')) {
      return '';
    }

    // E. Any other external frontend domain defaults to central Render backend
    return CENTRAL_RENDER_BACKEND;
  }

  return CENTRAL_RENDER_BACKEND;
}

export const API_BASE_URL = getResolvedBaseUrl();

/**
 * Returns the fully qualified URL for an API endpoint.
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getResolvedBaseUrl();
  if (!baseUrl) {
    return cleanEndpoint;
  }
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Returns the fully qualified WebSocket URL for real-time live interaction.
 * Automatically converts http/https to ws/wss.
 */
export function getWebSocketUrl(endpoint: string = '/api/live'): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Explicit WebSocket URL override if configured
  const explicitWsUrl = (import.meta.env.VITE_WS_URL || '').trim();
  if (explicitWsUrl) {
    return `${explicitWsUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
  }

  const baseUrl = getResolvedBaseUrl();
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${parsed.host}${cleanEndpoint}`;
    } catch {
      // fallback to window.location
    }
  }

  // Standard browser window location fallback
  if (typeof window !== 'undefined' && window.location) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}${cleanEndpoint}`;
  }

  return `wss://tasfi.onrender.com${cleanEndpoint}`;
}
