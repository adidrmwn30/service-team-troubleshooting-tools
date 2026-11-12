import { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { B3_ORG_UUID, parseB3Credentials } from './b3InboxService';
import type { B3Credentials } from './b3InboxService';

let mainWindow: BrowserWindow | null = null;

interface B3Session extends B3Credentials {
  maskedToken: string;
}

let b3Session: B3Session | null = null;

function getB3SessionFilePath(): string {
  // Share the same userData session path as the main app if possible, or local to this app
  return path.join(app.getPath('userData'), 'b3-troubleshooting-session.json');
}

function maskedB3Token(token: string): string {
  return token.length > 12 ? `${token.slice(0, 8)}...${token.slice(-4)}` : 'configured';
}

function loadB3Session(): B3Session | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const data = JSON.parse(fs.readFileSync(getB3SessionFilePath(), 'utf8')) as { encryptedToken?: string; orgUuid?: string };
    if (!data.encryptedToken?.startsWith('enc:') || !data.orgUuid) return null;
    const encrypted = Buffer.from(data.encryptedToken.slice(4), 'base64');
    const sessionToken = safeStorage.decryptString(encrypted);
    if (!sessionToken) return null;
    return { sessionToken, orgUuid: data.orgUuid, maskedToken: maskedB3Token(sessionToken) };
  } catch {
    return null;
  }
}

function saveB3Session(credentials: B3Credentials): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const filePath = getB3SessionFilePath();
  const tempPath = `${filePath}.tmp`;
  try {
    const encrypted = safeStorage.encryptString(credentials.sessionToken).toString('base64');
    fs.writeFileSync(tempPath, JSON.stringify({ encryptedToken: `enc:${encrypted}`, orgUuid: credentials.orgUuid }), { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
    return true;
  } catch {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    return false;
  }
}

function clearB3Session(): void {
  b3Session = null;
  try {
    const filePath = getB3SessionFilePath();
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function safeOpenExternal(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(parsed.href);
      return true;
    }
  } catch {}
  return false;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'Service Team Troubleshooting Tools',
    backgroundColor: '#030712',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const isDev = process.env.ELECTRON_DEV === '1' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5199');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept in-window navigation to prevent opening remote URLs inside the desktop app frame
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (isDev && (parsedUrl.origin === 'http://localhost:5199' || parsedUrl.origin === 'http://127.0.0.1:5199')) {
        return;
      }
      if (parsedUrl.protocol === 'file:') {
        return;
      }
    } catch {}
    event.preventDefault();
    safeOpenExternal(navigationUrl);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// SIEM IPC Handlers
ipcMain.handle('call-quality:get-session', () => {
  if (!b3Session) {
    b3Session = loadB3Session();
  }
  return {
    active: !!b3Session,
    maskedToken: b3Session?.maskedToken,
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
  };
});

ipcMain.handle('call-quality:fetch-siem-events', async (_event, txnUuid: string) => {
  if (!txnUuid || typeof txnUuid !== 'string' || !txnUuid.trim()) {
    return { success: false, error: 'A valid Transaction UUID is required.' };
  }

  const cleanTxn = txnUuid.trim();

  if (!b3Session) {
    b3Session = loadB3Session();
  }

  if (!b3Session) {
    return {
      success: false,
      requiresAuth: true,
      error: 'No active B3 session found. Paste your B3 cURL or session token to connect.',
    };
  }

  try {
    const endpoint = `https://portal.b3networks.com/_a/siem/private/v1/universalEvent?txnUuid=${encodeURIComponent(cleanTxn)}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        cookie: `sessionToken=${b3Session.sessionToken}`,
        origin: 'https://portal.b3networks.com',
        referer: 'https://portal.b3networks.com/',
        'x-user-org-uuid': b3Session.orgUuid,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 401 || response.status === 403) {
      clearB3Session();
      return {
        success: false,
        requiresAuth: true,
        error: 'B3 session expired (HTTP 401/403). Please renew your B3 session token.',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `B3 SIEM endpoint returned HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
      maskedToken: b3Session.maskedToken,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to fetch SIEM events from B3 endpoint.',
    };
  }
});

ipcMain.handle('call-quality:save-session', async (_event, rawInput: string) => {
  try {
    const parsed = parseB3Credentials(rawInput);
    const secureStorageAvailable = saveB3Session(parsed.credentials);
    b3Session = {
      ...parsed.credentials,
      maskedToken: maskedB3Token(parsed.credentials.sessionToken),
    };
    return {
      success: true,
      maskedToken: b3Session.maskedToken,
      secureStorageAvailable,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid B3 session token or cURL.',
    };
  }
});

ipcMain.handle('call-quality:clear-session', () => {
  clearB3Session();
  return { success: true };
});

ipcMain.handle('call-quality:open-login-window', async () => {
  return new Promise<{ success: boolean; maskedToken?: string; cancelled?: boolean; error?: string }>((resolve) => {
    let resolved = false;

    const authWindow = new BrowserWindow({
      width: 640,
      height: 760,
      title: 'Sign In to B3 Networks',
      parent: mainWindow ?? undefined,
      modal: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Restrict auth navigation strictly to B3 portal and official SSO identity providers
    authWindow.webContents.on('will-navigate', (event, targetUrl) => {
      try {
        const host = new URL(targetUrl).hostname.toLowerCase();
        const allowedHosts = [
          'b3networks.com',
          'portal.b3networks.com',
          'accounts.google.com',
          'login.microsoftonline.com',
        ];
        const isAllowed = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
        if (!isAllowed) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    // Use standard Chrome User Agent to avoid Google OAuth blocking Electron embedded browsers
    const chromeUserAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    authWindow.webContents.setUserAgent(chromeUserAgent);

    // Deny popup / child windows in authentication context
    authWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const checkAndExtractCookie = async () => {
      if (resolved || authWindow.isDestroyed()) return;
      try {
        const cookies = await authWindow.webContents.session.cookies.get({ domain: 'b3networks.com' });
        const portalCookies = await authWindow.webContents.session.cookies.get({ domain: 'portal.b3networks.com' });
        const allCookies = [...cookies, ...portalCookies];

        const sessionCookie = allCookies.find(
          (c) => c.name.toLowerCase() === 'sessiontoken' && c.value && c.value.length >= 16
        );

        if (sessionCookie && !resolved) {
          resolved = true;
          const sessionToken = sessionCookie.value;
          saveB3Session({ sessionToken, orgUuid: B3_ORG_UUID });
          b3Session = {
            sessionToken,
            orgUuid: B3_ORG_UUID,
            maskedToken: maskedB3Token(sessionToken),
          };
          if (!authWindow.isDestroyed()) {
            authWindow.close();
          }
          resolve({ success: true, maskedToken: b3Session.maskedToken });
        }
      } catch {
        // Continue listening
      }
    };

    authWindow.webContents.session.cookies.on('changed', async (_event, cookie, _cause, removed) => {
      if (!removed && cookie.name.toLowerCase() === 'sessiontoken' && cookie.value && cookie.value.length >= 16) {
        if (!resolved) {
          resolved = true;
          const sessionToken = cookie.value;
          saveB3Session({ sessionToken, orgUuid: B3_ORG_UUID });
          b3Session = {
            sessionToken,
            orgUuid: B3_ORG_UUID,
            maskedToken: maskedB3Token(sessionToken),
          };
          if (!authWindow.isDestroyed()) {
            authWindow.close();
          }
          resolve({ success: true, maskedToken: b3Session.maskedToken });
        }
      }
    });

    authWindow.webContents.on('did-navigate', checkAndExtractCookie);
    authWindow.webContents.on('did-finish-load', checkAndExtractCookie);

    authWindow.on('closed', () => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, cancelled: true });
      }
    });

    authWindow.loadURL('https://portal.b3networks.com/').catch((err) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: err.message });
      }
    });
  });
});

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  if (url) safeOpenExternal(url);
});

// ==========================================
// Globalping.io Network Diagnostic Handlers
// ==========================================
const GLOBALPING_API_BASE = 'https://api.globalping.io/v1';
const ALLOWED_DIAGNOSTIC_TYPES = new Set(['ping', 'traceroute', 'dns', 'mtr', 'http']);
const TARGET_VALIDATION_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]{0,253})$/;

function isPrivateOrLoopback(target: string): boolean {
  const clean = target.replace(/^https?:\/\//i, '').replace(/\/+$/, '').split(':')[0].trim().toLowerCase();
  if (clean === 'localhost' || clean === '::1' || clean === '0.0.0.0') return true;

  const ipv4Match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    if (o1 === 127) return true;
    if (o1 === 10) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 169 && o2 === 254) return true;
    if (o1 === 0) return true;
  }
  return false;
}

interface GlobalpingCreatePayload {
  type: string;
  target: string;
  limit?: number;
  locations?: Array<{ country?: string; continent?: string; city?: string; asn?: number }>;
  measurementOptions?: Record<string, any>;
}

ipcMain.handle('globalping:create-measurement', async (_event, payload: GlobalpingCreatePayload) => {
  try {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid payload: expected request object.' };
    }

    const { type, target, limit = 1, locations, measurementOptions } = payload;

    if (!type || !ALLOWED_DIAGNOSTIC_TYPES.has(type)) {
      return {
        success: false,
        error: `Invalid diagnostic type. Must be one of: ${Array.from(ALLOWED_DIAGNOSTIC_TYPES).join(', ')}`,
      };
    }

    const cleanTarget = (target || '').trim();
    if (!cleanTarget || !TARGET_VALIDATION_REGEX.test(cleanTarget)) {
      return {
        success: false,
        error: 'Invalid target address. Provide a valid hostname, IP address, or URL without unsafe characters.',
      };
    }

    if (isPrivateOrLoopback(cleanTarget)) {
      return {
        success: false,
        error: 'Private, loopback, or link-local targets (RFC1918/RFC3927) cannot be probed from public Globalping probes.',
      };
    }

    const clampedLimit = Math.min(Math.max(Number(limit) || 1, 1), 5);

    const body: Record<string, any> = {
      type,
      target: cleanTarget,
      limit: clampedLimit,
    };

    if (Array.isArray(locations) && locations.length > 0) {
      body.locations = locations.slice(0, 5).map((loc) => {
        const item: Record<string, any> = {};
        if (typeof loc.country === 'string' && loc.country.trim()) item.country = loc.country.trim().toUpperCase();
        if (typeof loc.continent === 'string' && loc.continent.trim()) item.continent = loc.continent.trim().toUpperCase();
        if (typeof loc.city === 'string' && loc.city.trim()) item.city = loc.city.trim();
        if (typeof loc.asn === 'number' && Number.isInteger(loc.asn)) item.asn = loc.asn;
        return item;
      });
    }

    if (measurementOptions && typeof measurementOptions === 'object') {
      body.measurementOptions = measurementOptions;
    }

    const response = await fetch(`${GLOBALPING_API_BASE}/measurements`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'B3-Networks-L2-Support-Workbench/1.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    if (response.status === 429) {
      return {
        success: false,
        isRateLimited: true,
        error: `Globalping rate limit exceeded. Reset in ${rateLimitReset || 'a few'} seconds.`,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : 0,
      };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `Globalping API error (HTTP ${response.status})`;
      return {
        success: false,
        error: msg,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      };
    }

    return {
      success: true,
      id: data.id,
      status: data.status || 'in-progress',
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
    };
  } catch (error: any) {
    const causeDetail = error?.cause?.message ? ` (${error.cause.message})` : '';
    return {
      success: false,
      error: error?.name === 'TimeoutError'
        ? 'Measurement creation timed out after 15 seconds.'
        : `Network error connecting to Globalping API: ${error?.message || 'fetch failed'}${causeDetail}`,
    };
  }
});

ipcMain.handle('globalping:get-measurement', async (_event, id: string) => {
  try {
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id.trim())) {
      return { success: false, error: 'A valid measurement ID is required.' };
    }

    const cleanId = id.trim();
    const response = await fetch(`${GLOBALPING_API_BASE}/measurements/${encodeURIComponent(cleanId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'B3-Networks-L2-Support-Workbench/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

    if (response.status === 429) {
      return {
        success: false,
        isRateLimited: true,
        error: 'Globalping polling rate limited. Pausing polling cycle.',
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : 0,
      };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || `Failed to fetch measurement (HTTP ${response.status})`,
        rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
      };
    }

    return {
      success: true,
      data,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : undefined,
    };
  } catch (error: any) {
    const causeDetail = error?.cause?.message ? ` (${error.cause.message})` : '';
    return {
      success: false,
      error: error?.name === 'TimeoutError'
        ? 'Measurement status polling timed out after 10 seconds.'
        : `Network error polling Globalping API: ${error?.message || 'fetch failed'}${causeDetail}`,
    };
  }
});

app.whenReady().then(() => {
  // Security hardening: Deny all permission requests (camera, microphone, geolocation, notifications)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
