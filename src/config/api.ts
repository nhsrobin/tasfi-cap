
import { Capacitor } from '@capacitor/core';

export const CENTRAL_RENDER_BACKEND =
  'https://tasfi.onrender.com';

export function isCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getResolvedBaseUrl(): string {
  // Native Android/iOS: always use Render backend
  if (isCapacitor()) {
    return CENTRAL_RENDER_BACKEND;
  }

  // Explicit override for web only
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Render frontend and backend on same domain
    if (hostname === 'tasfi.onrender.com') {
      return '';
    }

    // Local development
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('run.app')
    ) {
      return '';
    }

    // Vercel or any external frontend
    return CENTRAL_RENDER_BACKEND;
  }

  return CENTRAL_RENDER_BACKEND;
}

export const API_BASE_URL = getResolvedBaseUrl();

export function getApiUrl(endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${getResolvedBaseUrl()}${path}`;
}

export function getWebSocketUrl(
  endpoint: string = '/api/live'
): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const explicitWsUrl = (import.meta.env.VITE_WS_URL || '').trim();

  if (explicitWsUrl) {
    return `${explicitWsUrl.replace(/\/+$/, '')}${path}`;
  }

  const baseUrl = getResolvedBaseUrl();

  if (baseUrl) {
    const parsed = new URL(baseUrl);
    const protocol =
      parsed.protocol === 'https:' ? 'wss:' : 'ws:';

    return `${protocol}//${parsed.host}${path}`;
  }

  if (typeof window !== 'undefined') {
    const protocol =
      window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    return `${protocol}//${window.location.host}${path}`;
  }

  return `wss://tasfi.onrender.com${path}`;
}
