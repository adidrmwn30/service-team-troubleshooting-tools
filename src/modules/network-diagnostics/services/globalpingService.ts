/// <reference path="../../../types/electron.d.ts" />

import {
  DiagnosticType,
  NetworkDiagnosticResult,
} from '../types';
import { normalizeGlobalpingResponse } from './globalpingNormalizer';

export interface CreateMeasurementParams {
  target: string;
  type: DiagnosticType;
  locations?: Array<{ country?: string; continent?: string; city?: string; asn?: number }>;
  locationLabel?: string;
  limit?: number;
  measurementOptions?: Record<string, any>;
  dnsQueryType?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  cleanTarget?: string;
}

const STORAGE_KEY = 'b3_network_diagnostic_history_v1';
const MAX_HISTORY_ITEMS = 50;
const GLOBALPING_API_BASE = 'https://api.globalping.io/v1';

export class GlobalpingService {
  /**
   * Resolves the appropriate Globalping API endpoint base.
   * If running in a browser without Electron IPC (e.g. Vite dev on localhost),
   * routes via Vite reverse proxy `/api/globalping/v1` to bypass browser CORS restrictions.
   */
  public static getApiBase(): string {
    if (typeof window !== 'undefined' && !window.electronAPI?.createGlobalpingMeasurement) {
      if (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return '/api/globalping/v1';
      }
    }
    return GLOBALPING_API_BASE;
  }

  /**
   * Helper to identify private RFC1918, loopback, or link-local targets.
   */
  public static isPrivateOrLoopbackTarget(target: string): boolean {
    const clean = target.replace(/^https?:\/\//i, '').replace(/\/+$/, '').split(':')[0].trim().toLowerCase();
    if (clean === 'localhost' || clean === '::1' || clean === '0.0.0.0') return true;

    const ipv4Match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octet1 = parseInt(ipv4Match[1], 10);
      const octet2 = parseInt(ipv4Match[2], 10);
      if (octet1 === 127) return true; // Loopback
      if (octet1 === 10) return true; // RFC1918 Private
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true; // RFC1918 Private
      if (octet1 === 192 && octet2 === 168) return true; // RFC1918 Private
      if (octet1 === 169 && octet2 === 254) return true; // Link-local / AWS metadata
      if (octet1 === 0) return true;
    }
    return false;
  }

  /**
   * Validates target string based on diagnostic type and format safety.
   */
  public static validateTarget(rawTarget: string, type: DiagnosticType): ValidationResult {
    const trimmed = (rawTarget || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Target destination cannot be empty.' };
    }

    if (/\s/.test(trimmed)) {
      return { valid: false, error: 'Target address must not contain spaces.' };
    }

    if (/[;&|`$<>]/.test(trimmed)) {
      return { valid: false, error: 'Target contains invalid shell/command characters.' };
    }

    if (this.isPrivateOrLoopbackTarget(trimmed)) {
      return {
        valid: false,
        error: 'Private, loopback, or link-local targets (RFC1918/RFC3927) cannot be probed from public Globalping probes.',
      };
    }

    if (type === 'http') {
      // Must be a valid hostname, IP, or URL
      const clean = trimmed.replace(/^https?:\/\//i, '');
      if (!clean || clean.length > 253) {
        return { valid: false, error: 'Invalid HTTP/TLS destination target.' };
      }
      return { valid: true, cleanTarget: trimmed };
    }

    // Ping, Traceroute, MTR, DNS: hostname or IPv4 / IPv6
    // Strip trailing slash if accidentally added
    const clean = trimmed.replace(/\/+$/, '');
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[a-fA-F0-9:]+$/;

    if (!hostnameRegex.test(clean) && !ipv4Regex.test(clean) && !ipv6Regex.test(clean)) {
      return { valid: false, error: `Invalid ${type.toUpperCase()} target format. Provide a valid hostname or IP.` };
    }

    return { valid: true, cleanTarget: clean };
  }

  /**
   * Creates a Globalping measurement via Electron IPC or direct fetch fallback.
   */
  public static async createMeasurement(
    params: CreateMeasurementParams
  ): Promise<{ measurementId: string; status: string; rateLimitRemaining?: number }> {
    const validation = this.validateTarget(params.target, params.type);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid target.');
    }

    const payload = {
      type: params.type,
      target: validation.cleanTarget || params.target,
      limit: params.limit || 1,
      locations: params.locations,
      measurementOptions: params.measurementOptions,
    };

    // Use Electron IPC bridge if available
    if (typeof window !== 'undefined' && window.electronAPI?.createGlobalpingMeasurement) {
      const res = await window.electronAPI.createGlobalpingMeasurement(payload);
      if (!res.success || !res.id) {
        if (res.isRateLimited) {
          throw new Error(res.error || 'Globalping rate limit exceeded. Please wait a moment.');
        }
        throw new Error(res.error || 'Failed to dispatch measurement via main process.');
      }
      return {
        measurementId: res.id,
        status: res.status || 'in-progress',
        rateLimitRemaining: res.rateLimitRemaining,
      };
    }

    // Direct HTTP fetch fallback (for browser dev via Vite proxy or node tests)
    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/measurements`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

      if (response.status === 429) {
        throw new Error('Globalping API rate limit exceeded (HTTP 429). Please wait before re-testing.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || `Globalping API error (${response.status})`);
      }

      return {
        measurementId: data.id,
        status: data.status || 'in-progress',
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      };
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        throw new Error(
          'Network error: Failed to reach Globalping API. If testing in a browser, ensure the Vite dev proxy is running; if in Electron, check your network connection.'
        );
      }
      throw err;
    }
  }

  /**
   * Polls measurement status and results by ID.
   */
  public static async getMeasurement(
    id: string
  ): Promise<{ status: string; data: any; rateLimitRemaining?: number }> {
    if (typeof window !== 'undefined' && window.electronAPI?.getGlobalpingMeasurement) {
      const res = await window.electronAPI.getGlobalpingMeasurement(id);
      if (!res.success || !res.data) {
        if (res.isRateLimited) {
          throw new Error(res.error || 'Polling rate limited.');
        }
        throw new Error(res.error || 'Failed to fetch measurement result.');
      }
      return {
        status: res.data.status,
        data: res.data,
        rateLimitRemaining: res.rateLimitRemaining,
      };
    }

    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/measurements/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

      if (response.status === 429) {
        throw new Error('Globalping polling rate limited (HTTP 429).');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error?.message || `Failed to fetch measurement (${response.status})`);
      }

      return {
        status: data.status,
        data,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      };
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        throw new Error(
          'Network error: Polling interrupted due to unreachable Globalping API. Check internet connection.'
        );
      }
      throw err;
    }
  }

  /**
   * Executes a diagnostic measurement end-to-end: creation, asynchronous polling, normalization, and history storage.
   */
  public static async runDiagnostic(
    params: CreateMeasurementParams,
    options?: {
      onProgress?: (status: string, elapsedSeconds: number) => void;
      signal?: AbortSignal;
      pollIntervalMs?: number;
      maxTimeoutMs?: number;
    }
  ): Promise<NetworkDiagnosticResult> {
    const pollInterval = options?.pollIntervalMs || 1000;
    const maxTimeout = options?.maxTimeoutMs || 30_000;
    const startedAt = new Date().toISOString();
    const locationLabel = params.locationLabel || 'Global Vantage Point';

    // 1. Create measurement
    const creation = await this.createMeasurement(params);
    const measurementId = creation.measurementId;

    let elapsed = 0;
    const startTime = Date.now();

    // 2. Poll until finished, failed, cancelled, or timed out
    while (Date.now() - startTime < maxTimeout) {
      if (options?.signal?.aborted) {
        const cancelledResult: NetworkDiagnosticResult = {
          id: measurementId,
          target: params.target,
          diagnosticType: params.type,
          probeLocation: locationLabel,
          source: 'globalping',
          status: 'cancelled',
          startedAt,
          completedAt: new Date().toISOString(),
          errorMessage: 'Measurement cancelled by engineer.',
        };
        this.saveToHistory(cancelledResult);
        return cancelledResult;
      }

      elapsed = Math.round((Date.now() - startTime) / 1000);
      options?.onProgress?.('Awaiting probe execution...', elapsed);

      // Wait interval
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        const current = await this.getMeasurement(measurementId);

        if (current.status === 'finished' || current.status === 'failed') {
          const normalized = normalizeGlobalpingResponse(current.data, {
            id: measurementId,
            target: params.target,
            type: params.type,
            probeLocation: locationLabel,
            startedAt,
            dnsQueryType: params.dnsQueryType,
          });

          this.saveToHistory(normalized);
          return normalized;
        }
      } catch (err: any) {
        // If transient rate limit or network glitch during polling, log and keep trying until maxTimeout
        if (err?.message?.includes('rate limit')) {
          options?.onProgress?.('Throttled by API, retrying...', elapsed);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // Timeout expired
    const timeoutResult: NetworkDiagnosticResult = {
      id: measurementId,
      target: params.target,
      diagnosticType: params.type,
      probeLocation: locationLabel,
      source: 'globalping',
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      errorMessage: `Measurement timed out after ${Math.round(maxTimeout / 1000)} seconds without probe response.`,
    };
    this.saveToHistory(timeoutResult);
    return timeoutResult;
  }

  /**
   * Diagnostic History Retrieval with 7-day TTL auto-purge
   */
  public static getHistory(): NetworkDiagnosticResult[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Enforce 7-day retention policy (604800000 ms)
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const validHistory = parsed.filter((item: NetworkDiagnosticResult) => {
        if (!item.startedAt) return false;
        const itemTime = new Date(item.startedAt).getTime();
        return !isNaN(itemTime) && (now - itemTime) < SEVEN_DAYS_MS;
      });

      // If any expired items were pruned, persist pruned list
      if (validHistory.length !== parsed.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validHistory));
      }

      return validHistory;
    } catch {
      return [];
    }
  }

  /**
   * Persists a completed diagnostic result to local storage.
   */
  public static saveToHistory(result: NetworkDiagnosticResult): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const existing = this.getHistory();
      // Remove any previous record with identical id to avoid duplicates
      const filtered = existing.filter((item) => item.id !== result.id);
      const updated = [result, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Clears all diagnostic history.
   */
  public static clearHistory(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Removes a single history item by ID.
   */
  public static deleteHistoryItem(id: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const existing = this.getHistory();
      const filtered = existing.filter((item) => item.id !== id);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore errors
    }
  }
}
