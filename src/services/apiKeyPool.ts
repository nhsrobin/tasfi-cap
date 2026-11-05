/**
 * Client-Side API Key Pool Status Manager:
 * Synchronizes with the server-side API Key Pool via `/api/keys/status` and `/api/keys/rotate`.
 * Protects credentials by keeping raw API keys strictly on the server while maintaining
 * real-time cluster health indicators in the client UI.
 */

import { getApiUrl } from "../config/api";

export interface KeyItem {
  key: string;
  alias: string;
  cooldownUntil: number; // timestamp in ms
  failureCount: number;
  successCount: number;
  lastUsed: number;
  lastError: string | null;
}

export class ClientApiKeyPoolManager {
  private keys: KeyItem[] = [
    { key: "API_KEY_01", alias: "কি #১ (প্রাইমারি ক্লাস্টার)", cooldownUntil: 0, failureCount: 0, successCount: 0, lastUsed: 0, lastError: null },
    { key: "API_KEY_02", alias: "কি #২ (ফেইলওভার ব্যাকআপ)", cooldownUntil: 0, failureCount: 0, successCount: 0, lastUsed: 0, lastError: null },
    { key: "API_KEY_03", alias: "কি #৩ (অটো-ব্যালেন্সড)", cooldownUntil: 0, failureCount: 0, successCount: 0, lastUsed: 0, lastError: null },
    { key: "API_KEY_04", alias: "কি #৪ (হাই-ডিমান্ড ব্যাকআপ)", cooldownUntil: 0, failureCount: 0, successCount: 0, lastUsed: 0, lastError: null },
  ];
  private activeIndex: number = 0;
  private listeners: Array<() => void> = [];

  constructor() {
    this.refreshStatus();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore
      }
    }
  }

  public getTotalKeysCount(): number {
    return this.keys.length;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getKeyStatusList(): KeyItem[] {
    return this.keys;
  }

  /**
   * Helper for components that might query active key information
   */
  public getActiveKey() {
    const item = this.keys[this.activeIndex] || this.keys[0];
    return {
      key: item?.key || "SERVER_KEY",
      alias: item?.alias || "Active Server Key",
      index: this.activeIndex,
      markSuccess: () => {
        if (item) item.successCount++;
        this.notify();
      },
      markFailure: (isQuota: boolean = false, errorMsg?: string) => {
        if (item) {
          item.failureCount++;
          if (errorMsg) item.lastError = errorMsg;
          if (isQuota) {
            item.cooldownUntil = Date.now() + 60 * 1000;
          }
        }
        this.notify();
      },
    };
  }

  /**
   * Switches to the next key via the server rotation endpoint
   */
  public async rotateToNext(_cooldownCurrent: boolean = false): Promise<void> {
    try {
      const res = await fetch(getApiUrl("/api/keys/rotate"), { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.activeIndex === "number") {
          this.activeIndex = data.activeIndex;
        }
        if (Array.isArray(data.keys)) {
          this.keys = data.keys.map((k: any, idx: number) => ({
            key: k.key || `কি #${idx + 1}`,
            alias: k.alias || `কি #${idx + 1}`,
            cooldownUntil: k.cooldownUntil || 0,
            failureCount: k.failureCount || 0,
            successCount: k.successCount || 0,
            lastUsed: k.lastUsed || 0,
            lastError: k.lastError || null,
          }));
        }
        this.notify();
        return;
      }
    } catch {
      // Local fallback in case network is offline
    }

    this.activeIndex = (this.activeIndex + 1) % this.keys.length;
    this.notify();
  }

  /**
   * Fetches the latest key pool status and health metrics from `/api/keys/status`
   */
  public async refreshStatus(): Promise<void> {
    try {
      const res = await fetch(getApiUrl("/api/keys/status"));
      if (res.ok) {
        const data = await res.json();
        if (typeof data.activeIndex === "number") {
          this.activeIndex = data.activeIndex;
        }
        if (Array.isArray(data.keys) && data.keys.length > 0) {
          this.keys = data.keys.map((k: any, idx: number) => ({
            key: k.key || `কি #${idx + 1}`,
            alias: k.alias || `কি #${idx + 1}`,
            cooldownUntil: k.cooldownUntil || 0,
            failureCount: k.failureCount || 0,
            successCount: k.successCount || 0,
            lastUsed: k.lastUsed || 0,
            lastError: k.lastError || null,
          }));
        }
        this.notify();
      }
    } catch {
      // Ignore network failures on initial load
    }
  }
}

export const apiKeyPool = new ClientApiKeyPoolManager();

export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message || (typeof err === "string" ? err : JSON.stringify(err))).toLowerCase();
  const status = (err?.status || err?.code || "").toString().toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("exceeded your current quota") ||
    status === "429" ||
    status === "503" ||
    status === "resource_exhausted" ||
    status === "unavailable"
  );
}
