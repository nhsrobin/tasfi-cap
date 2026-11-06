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

import { Capacitor } from '@capacitor/core';

export const CENTRAL_RENDER_BACKEND = 'https://tasfi.onrender.com';

export function getResolvedBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();

  // Native Android/iOS must always use the hosted backend.
  if (Capacitor.isNativePlatform()) {
    return (envUrl || CENTRAL_RENDER_BACKEND).replace(/\/+$/, '');
  }

  // Explicit environment override for web deployments.
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (
      protocol === 'capacitor:' ||
      protocol === 'ionic:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      return '';
    }

    if (hostname.includes('vercel.app')) {
      return CENTRAL_RENDER_BACKEND;
    }

    if (hostname.includes('onrender.com')) {
      return '';
    }

    return CENTRAL_RENDER_BACKEND;
  }

  return CENTRAL_RENDER_BACKEND;
}

export const API_BASE_URL = getResolvedBaseUrl();

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  return `${getResolvedBaseUrl()}${cleanEndpoint}`;
}

export function getWebSocketUrl(endpoint = '/api/live'): string {
  const cleanEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  const explicitWsUrl = (import.meta.env.VITE_WS_URL || '').trim();

  if (explicitWsUrl) {
    return `${explicitWsUrl.replace(/\/+$/, '')}${cleanEndpoint}`;
  }

  const baseUrl = getResolvedBaseUrl();

  if (baseUrl) {
    const parsed = new URL(baseUrl);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${parsed.host}${cleanEndpoint}`;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${cleanEndpoint}`;
  }

  return `wss://tasfi.onrender.com${cleanEndpoint}`;
}
