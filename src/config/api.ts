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

export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  const href = window.location.href;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // 1. Injected Capacitor bridge object
  const cap = (window as any).Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    if (cap.getPlatform && cap.getPlatform() !== 'web') return true;
    if (cap.platform && cap.platform !== 'web') return true;
  }

  // 2. Custom protocols in native WebView
  if (protocol === 'capacitor:' || protocol === 'ionic:' || href.startsWith('capacitor://') || href.startsWith('ionic://')) {
    return true;
  }

  // 3. Android WebView localhost scheme without standard dev server port
  // Capacitor Android WebView serves files from https://localhost or http://localhost with NO port (port === '')
  // Desktop development on the other hand ALWAYS has a port (e.g. 3000, 5173, etc.)
  if (hostname === 'localhost' && (!port || port === '' || port === '80' || port === '443')) {
    return true;
  }

  return false;
}

export function getResolvedBaseUrl(): string {
  // 1. Explicit env var override (if user sets VITE_API_URL in .env or dashboard)
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Client-side Smart Environment Detection
  if (typeof window !== 'undefined' && window.location) {
    // A. Capacitor Native Android/iOS App Environment -> ALWAYS use central Render backend
    if (isCapacitor()) {
      return CENTRAL_RENDER_BACKEND;
    }

    const hostname = window.location.hostname;
    const port = window.location.port;

    // B. Vercel Web Deployment (*.vercel.app or custom Vercel domain)
    if (hostname.includes('vercel.app')) {
      return CENTRAL_RENDER_BACKEND;
    }

    // C. Hosted directly on Render (both frontend and backend together)
    // Uses relative paths ('') for direct zero-latency in-memory routing
    if (hostname.includes('onrender.com') || hostname === 'tasfi.onrender.com') {
      return '';
    }

    // D. Localhost dev server (port 3000) or Cloud Dev Environment
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return '';
    }
    if (hostname.includes('run.app')) {
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