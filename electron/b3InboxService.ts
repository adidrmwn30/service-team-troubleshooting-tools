export const B3_QUERY_ENDPOINT = 'https://portal.b3networks.com/_a/inbox/private/v5/txn/_query';
export const B3_DETAIL_ENDPOINT = 'https://portal.b3networks.com/_a/inbox/private/v3/txn';
export const B3_END_ENDPOINT = 'https://portal.b3networks.com/_a/inbox/private/v2/txn';
export const B3_DIRECTORY_MEMBERS_ENDPOINT = 'https://portal.b3networks.com/_a/directory/private/v2/members/all';
export const B3_ORG_UUID = 'fc312420-0047-49a7-94a8-003f11f115c0';
export const B3_INBOX_UUIDS = {
  emailSupport: '2d7b0142-5676-405e-8278-ec65c117ff94',
  supportCenter: 'e32f1d27-a969-4b64-9c71-107daf99a8fe',
} as const;
export const B3_INBOX_NAMES: Record<string, string> = {
  [B3_INBOX_UUIDS.emailSupport]: 'Email Support',
  [B3_INBOX_UUIDS.supportCenter]: 'Support Center Inbox',
};

export interface B3Credentials {
  sessionToken: string;
  orgUuid: string;
}

export interface B3InboxTicketRecord {
  id: string;
  txnUuid: string;
  sid?: string;
  status: string;
  inboxUuid: string;
  inboxName: string;
  title: string;
  customer: string;
  createdByName?: string;
  createdByIdentity?: string;
  assignees: string[] | null;
  createdAt?: string;
  updatedAt?: string;
  endedAt?: string;
  latestMsgInMilisecond?: number;
}

export interface B3SyncProgress {
  statusGroup: 'waiting / assigned' | 'ended';
  page: number;
  requests: number;
  recordsRetrieved: number;
}

export interface B3SyncResult {
  tickets: B3InboxTicketRecord[];
  requests: number;
  recordsRetrieved: number;
}

export interface B3InboxCacheSnapshot {
  tickets: B3InboxTicketRecord[];
  lastSuccessfulSyncAt: string;
}

interface ParsedCurlRequest {
  url: string;
  method: string;
  headers: Map<string, string>;
  body?: string;
}

const DEFAULT_QUERY_BODY = {
  statuses: ['waiting', 'assigned'],
  channels: ['supportCenter'],
  viewMode: null,
  textSearch: '',
  searchBy: 'uuid',
  reporters: [],
  assignees: [],
  inboxUuids: [B3_INBOX_UUIDS.supportCenter, B3_INBOX_UUIDS.emailSupport],
};

function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: "'" | '"' | null = null;
  let active = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '\\' && input[index + 1] === '\n') {
      index += 1;
      continue;
    }
    if (character === '\\' && input[index + 1] === '\r' && input[index + 2] === '\n') {
      index += 2;
      continue;
    }

    if (quote === "'") {
      if (character === "'") quote = null;
      else token += character;
      active = true;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = null;
      else if (character === '\\' && index + 1 < input.length) token += input[++index];
      else token += character;
      active = true;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      active = true;
    } else if (character === '\\' && index + 1 < input.length) {
      token += input[++index];
      active = true;
    } else if (/\s/.test(character)) {
      if (active) tokens.push(token);
      token = '';
      active = false;
    } else {
      token += character;
      active = true;
    }
  }

  if (quote) throw new Error('The pasted cURL has an unmatched quote.');
  if (active) tokens.push(token);
  return tokens;
}

function parseCurlRequest(input: string): ParsedCurlRequest {
  const args = tokenizeCurl(input.trim());
  if (args[0]?.toLowerCase() !== 'curl') throw new Error('Paste a raw session token or a full cURL command.');

  let url = '';
  let method = '';
  let body: string | undefined;
  const headers = new Map<string, string>();

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];
    if (argument === '-X' || argument === '--request') {
      if (next) method = next.toUpperCase();
      index += 1;
    } else if (/^-X[A-Za-z]+$/.test(argument)) {
      method = argument.slice(2).toUpperCase();
    } else if (argument === '-H' || argument === '--header') {
      if (next) {
        const separator = next.indexOf(':');
        if (separator > 0) headers.set(next.slice(0, separator).trim().toLowerCase(), next.slice(separator + 1).trim());
      }
      index += 1;
    } else if (argument === '-b' || argument === '--cookie') {
      if (next) headers.set('cookie', next);
      index += 1;
    } else if (argument === '-d' || argument === '--data' || argument === '--data-raw' || argument === '--data-binary') {
      body = next;
      index += 1;
    } else if (argument === '--url') {
      url = next ?? '';
      index += 1;
    } else if (/^https?:\/\//i.test(argument)) {
      url = argument;
    }
  }

  if (!url) throw new Error('The cURL command does not contain a request URL.');
  if (!method) method = body !== undefined ? 'POST' : 'GET';
  return { url, method, headers, body };
}

function validateQueryRequest(request: ParsedCurlRequest): { requestUrl: URL; body: Record<string, unknown> } {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    throw new Error('The cURL request URL is invalid.');
  }

  if (requestUrl.protocol !== 'https:' || requestUrl.hostname !== 'portal.b3networks.com') {
    throw new Error('Only the verified B3Networks portal _query endpoint is allowed.');
  }
  if (['PUT', 'DELETE', 'PATCH'].includes(request.method.toUpperCase())) {
    throw new Error('Write or mutation B3 requests are not allowed. Only read-only B3 _query requests are allowed.');
  }
  if (requestUrl.pathname.includes('/_end')) {
    throw new Error('Only the verified B3Networks read _query endpoint is allowed.');
  }

  let body: Record<string, unknown> = { ...DEFAULT_QUERY_BODY };
  if (request.body !== undefined) {
    try {
      const parsed: unknown = JSON.parse(request.body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const parsedObj = parsed as Record<string, unknown>;
        if (!Array.isArray(parsedObj.txnUuids)) {
          body = parsedObj;
        }
      }
    } catch {
      // Safely default to DEFAULT_QUERY_BODY if body is not valid JSON
    }
  }
  return { requestUrl, body };
}

export function parseB3Credentials(input: string): { credentials: B3Credentials; queryBody: Record<string, unknown> } {
  const text = input.trim();
  if (!text) throw new Error('Paste a session token or a full B3 _query cURL command.');

  if (!/^curl\b/i.test(text)) {
    const token = text.replace(/^sessionToken=/i, '');
    if (!/^[a-zA-Z0-9_.-]{16,}$/.test(token)) throw new Error('The session token format is not valid.');
    return { credentials: { sessionToken: token, orgUuid: B3_ORG_UUID }, queryBody: { ...DEFAULT_QUERY_BODY } };
  }

  const request = parseCurlRequest(text);
  const { requestUrl, body } = validateQueryRequest(request);
  const cookie = request.headers.get('cookie') ?? '';
  const sessionToken = cookie.match(/(?:^|;\s*)sessionToken=([^;\s]+)/i)?.[1]
    ?? request.headers.get('x-session-token')
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!sessionToken) throw new Error('The cURL request does not contain a sessionToken cookie.');

  const orgUuid = request.headers.get('x-user-org-uuid') ?? requestUrl.searchParams.get('orgUuid') ?? B3_ORG_UUID;
  if (!/^[a-fA-F0-9-]{36}$/.test(orgUuid)) throw new Error('The B3 organization UUID is invalid.');
  return { credentials: { sessionToken, orgUuid }, queryBody: body };
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

export async function fetchB3DirectoryMembers(
  credentials: B3Credentials,
  fetcher: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const memberMap = new Map<string, string>();
  try {
    const response = await fetcher(B3_DIRECTORY_MEMBERS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        cookie: `sessionToken=${credentials.sessionToken}`,
        origin: 'https://portal.b3networks.com',
        referer: 'https://portal.b3networks.com/apps/unifiedworkspace/1.1.1rc2/',
        'x-user-org-uuid': credentials.orgUuid,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return memberMap;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return memberMap;
    for (const member of data) {
      if (member && typeof member === 'object') {
        const record = member as Record<string, unknown>;
        const uuid = typeof record.uuid === 'string' ? record.uuid.trim() : '';
        const identityUuid = typeof record.identityUuid === 'string' ? record.identityUuid.trim() : '';
        const memberUuid = typeof record.memberUuid === 'string' ? record.memberUuid.trim() : '';
        const nameCandidate = typeof record.displayName === 'string' && record.displayName.trim()
          ? record.displayName.trim()
          : (typeof record.name === 'string' && record.name.trim() ? record.name.trim() : '');
        if (nameCandidate) {
          if (uuid) memberMap.set(uuid, nameCandidate);
          if (identityUuid) memberMap.set(identityUuid, nameCandidate);
          if (memberUuid) memberMap.set(memberUuid, nameCandidate);
        }
      }
    }
  } catch {
    // Non-blocking fallback; returns any collected entries or empty map
  }
  return memberMap;
}

export function normalizeAssignees(value: unknown, memberMap?: ReadonlyMap<string, string>): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((assignee) => {
    if (typeof assignee === 'string') {
      const label = assignee.trim();
      if (/^[a-fA-F0-9]{8}-[a-fA-F0-9-]{20,}$/.test(label)) {
        const resolved = memberMap?.get(label);
        return resolved || 'Assignee label unavailable';
      }
      return label;
    }
    if (assignee && typeof assignee === 'object') {
      const item = assignee as Record<string, unknown>;
      const idCandidates = [item.uuid, item.identityUuid, item.memberUuid, item.identityId, item.id];
      for (const id of idCandidates) {
        if (typeof id === 'string' && memberMap?.has(id.trim())) {
          return memberMap.get(id.trim())!;
        }
      }
      const candidates = [item.identityName, item.displayName, item.identityLabel, item.label, item.name, item.email];
      const label = candidates.find((candidate) => typeof candidate === 'string'
        && candidate.trim()
        && !/^[a-fA-F0-9]{8}-[a-fA-F0-9-]{20,}$/.test(candidate.trim()));
      if (typeof label === 'string') return label.trim();
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && memberMap?.has(candidate.trim())) {
          return memberMap.get(candidate.trim())!;
        }
      }
      return 'Assignee label unavailable';
    }
    return '';
  }).filter(Boolean);
}

export function isClosableSelectedB3Ticket(ticket: Pick<B3InboxTicketRecord, 'status' | 'txnUuid'>): boolean {
  return (ticket.status === 'waiting' || ticket.status === 'assigned')
    && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,127}$/.test(ticket.txnUuid);
}

function matchesSenderRule(candidate: string, sender: string): boolean {
  if (candidate === sender) return true;

  // If sender rule is an email address or domain (contains '@')
  if (sender.includes('@')) {
    if (candidate.includes(sender)) return true;
  }

  // If candidate has email pattern like "Name <email@domain.com>" or "Name (email@domain.com)"
  const emailMatch = candidate.match(/^(.*?)\s*[<(]([^>)]+@[^>)]+)[>)]$/);
  if (emailMatch) {
    const extractedName = emailMatch[1].trim();
    const extractedEmail = emailMatch[2].trim();
    if (extractedName === sender || extractedEmail === sender) return true;
    if (sender.includes('@') && extractedEmail.includes(sender)) return true;
  }

  return false;
}

export function isSpamB3InboxTicketRecord(
  ticket: Pick<B3InboxTicketRecord, 'inboxUuid' | 'customer'> & { createdByName?: string },
  configuredSenders?: readonly string[],
): boolean {
  if (ticket.inboxUuid !== B3_INBOX_UUIDS.emailSupport) return false;

  const rawCandidates = [ticket.customer, ticket.createdByName]
    .filter((val): val is string => typeof val === 'string' && Boolean(val.trim()))
    .map((val) => val.trim().toLowerCase());

  if (rawCandidates.length === 0) return false;

  const senders = configuredSenders && configuredSenders.length > 0
    ? configuredSenders
    : ['Zulfadhli Muhamad (Jira)'];

  return senders.some((rawSender) => {
    if (!rawSender || typeof rawSender !== 'string') return false;
    const sender = rawSender.trim().toLowerCase();
    if (!sender) return false;

    return rawCandidates.some((candidate) => matchesSenderRule(candidate, sender));
  });
}

export function findClosableSpamTickets(
  tickets: readonly B3InboxTicketRecord[],
  spamSenders?: readonly string[],
): B3InboxTicketRecord[] {
  return tickets.filter((ticket) =>
    isClosableSelectedB3Ticket(ticket) && isSpamB3InboxTicketRecord(ticket, spamSenders)
  );
}

export async function closeSelectedB3Ticket(
  ticket: B3InboxTicketRecord,
  credentials: B3Credentials,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!isClosableSelectedB3Ticket(ticket)) {
    throw new Error('Only selected waiting or assigned B3 tickets with a valid transaction ID can be closed.');
  }

  const response = await fetcher(`${B3_END_ENDPOINT}/${encodeURIComponent(ticket.txnUuid)}/_end`, {
    method: 'PUT',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: `sessionToken=${credentials.sessionToken}`,
      origin: 'https://portal.b3networks.com',
      referer: 'https://portal.b3networks.com/apps/unifiedworkspace/1.1.1rc2/',
      'x-user-org-uuid': credentials.orgUuid,
    },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 401 || response.status === 403) throw new Error('B3Networks rejected the session. Renew it from Session / cURL.');
  if (!response.ok) throw new Error(`B3 ticket close failed (HTTP ${response.status}).`);
  const responseText = await response.text();
  if (responseText) {
    try {
      const result = JSON.parse(responseText) as { status?: string };
      if (result.status && result.status !== 'success') throw new Error('B3Networks did not confirm the ticket close.');
    } catch (error) {
      if (error instanceof Error && error.message === 'B3Networks did not confirm the ticket close.') throw error;
      throw new Error('B3Networks returned an invalid close confirmation.');
    }
  }
}

export function normalizeB3InboxTicket(value: unknown, memberMap?: ReadonlyMap<string, string>): B3InboxTicketRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.txnUuid !== 'string' || !raw.txnUuid.trim()) return null;

  const caseInfo = (raw.caseInfo && typeof raw.caseInfo === 'object')
    ? (raw.caseInfo as Record<string, unknown>)
    : undefined;

  let sid = typeof raw.sid === 'string' || typeof raw.sid === 'number'
    ? String(raw.sid)
    : undefined;
  if (!sid && caseInfo?.sid !== undefined && caseInfo?.sid !== null) {
    sid = String(caseInfo.sid);
  }

  const rawStatus = typeof raw.status === 'string' ? raw.status : 'unknown';
  const inboxUuid = typeof raw.inboxUuid === 'string' ? raw.inboxUuid : '';
  const customer = raw.customer && typeof raw.customer === 'object'
    ? String((raw.customer as Record<string, unknown>).displayName ?? '')
    : (raw.customerInfo && typeof raw.customerInfo === 'object'
      ? String((raw.customerInfo as Record<string, unknown>).displayName ?? '')
      : '');

  let createdByName: string | undefined;
  if (typeof raw.createdByIdentityName === 'string' && raw.createdByIdentityName.trim()) {
    createdByName = raw.createdByIdentityName.trim();
  } else if (caseInfo && typeof caseInfo.createdByIdentityName === 'string' && caseInfo.createdByIdentityName.trim()) {
    createdByName = caseInfo.createdByIdentityName.trim();
  } else if (raw.createdBy && typeof raw.createdBy === 'object' && typeof (raw.createdBy as Record<string, unknown>).displayName === 'string') {
    createdByName = String((raw.createdBy as Record<string, unknown>).displayName).trim();
  } else if (raw.reporter && typeof raw.reporter === 'object' && typeof (raw.reporter as Record<string, unknown>).displayName === 'string') {
    createdByName = String((raw.reporter as Record<string, unknown>).displayName).trim();
  } else if (typeof raw.creator === 'string' && raw.creator.trim()) {
    createdByName = raw.creator.trim();
  } else if (raw.creator && typeof raw.creator === 'object' && typeof (raw.creator as Record<string, unknown>).displayName === 'string') {
    createdByName = String((raw.creator as Record<string, unknown>).displayName).trim();
  }

  const createdByIdentity = typeof raw.createdByIdentity === 'string' && raw.createdByIdentity.trim()
    ? raw.createdByIdentity.trim()
    : (caseInfo && typeof caseInfo.createdByIdentity === 'string' && caseInfo.createdByIdentity.trim()
      ? caseInfo.createdByIdentity.trim()
      : undefined);

  if ((!createdByName || /^[a-fA-F0-9]{8}-[a-fA-F0-9-]{20,}$/.test(createdByName)) && createdByIdentity && memberMap?.has(createdByIdentity)) {
    createdByName = memberMap.get(createdByIdentity);
  }

  if (!createdByName && caseInfo?.originalEmail && typeof caseInfo.originalEmail === 'object') {
    const orig = caseInfo.originalEmail as Record<string, unknown>;
    if (orig.from && typeof orig.from === 'object') {
      const fromObj = orig.from as Record<string, unknown>;
      if (typeof fromObj.name === 'string' && fromObj.name.trim()) {
        createdByName = fromObj.name.trim();
      } else if (typeof fromObj.address === 'string' && fromObj.address.trim()) {
        createdByName = fromObj.address.trim();
      }
    }
  }

  const latestMessage = typeof raw.latestMsgInMilisecond === 'number' ? raw.latestMsgInMilisecond : undefined;

  return {
    id: raw.txnUuid,
    txnUuid: raw.txnUuid,
    sid,
    status: rawStatus,
    inboxUuid,
    inboxName: B3_INBOX_NAMES[inboxUuid] ?? 'Unknown Inbox',
    title: typeof raw.title === 'string' ? raw.title : '',
    customer,
    createdByName,
    createdByIdentity,
    assignees: normalizeAssignees(raw.assignees, memberMap),
    createdAt: normalizeTimestamp(raw.createdAt)
      ?? normalizeTimestamp(raw.createdTime)
      ?? normalizeTimestamp(raw.startedAt)
      ?? normalizeTimestamp(raw.time)
      ?? (caseInfo ? normalizeTimestamp(caseInfo.createdAt) : undefined)
      ?? normalizeTimestamp(raw.latestMsgInMilisecond),
    updatedAt: normalizeTimestamp(raw.updatedAt) ?? normalizeTimestamp(raw.latestMsgInMilisecond),
    endedAt: normalizeTimestamp(raw.endedAt),
    latestMsgInMilisecond: latestMessage,
  };
}

export async function fetchB3TicketDetail(
  txnUuid: string,
  credentials: B3Credentials,
  memberMap?: ReadonlyMap<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<B3InboxTicketRecord | null> {
  try {
    const response = await fetcher(`${B3_DETAIL_ENDPOINT}/${encodeURIComponent(txnUuid)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        cookie: `sessionToken=${credentials.sessionToken}`,
        origin: 'https://portal.b3networks.com',
        referer: 'https://portal.b3networks.com/apps/unifiedworkspace/1.1.1rc2/',
        'x-user-org-uuid': credentials.orgUuid,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return normalizeB3InboxTicket(data, memberMap);
  } catch {
    return null;
  }
}

export async function fetchB3InboxTickets(
  credentials: B3Credentials,
  queryBody: Record<string, unknown> = { ...DEFAULT_QUERY_BODY },
  onProgress?: (progress: B3SyncProgress) => void,
  fetcher: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<B3SyncResult> {
  const ticketMap = new Map<string, B3InboxTicketRecord>();
  let requests = 0;
  const groups: Array<{ label: B3SyncProgress['statusGroup']; statuses: string[]; maxPages: number }> = [
    { label: 'waiting / assigned', statuses: ['waiting', 'assigned'], maxPages: 16 },
    { label: 'ended', statuses: ['ended'], maxPages: 6 },
  ];

  const memberMap = await fetchB3DirectoryMembers(credentials, fetcher).catch(() => new Map<string, string>());

  for (const group of groups) {
    for (let page = 1; page <= group.maxPages; page += 1) {
      if (requests > 0) await wait(200);
      const requestUrl = new URL(B3_QUERY_ENDPOINT);
      requestUrl.searchParams.set('page', String(page));
      requestUrl.searchParams.set('perPage', '50');
      const response = await fetcher(requestUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          cookie: `sessionToken=${credentials.sessionToken}`,
          origin: 'https://portal.b3networks.com',
          referer: 'https://portal.b3networks.com/apps/unifiedworkspace/1.1.1rc2/',
          'x-user-org-uuid': credentials.orgUuid,
        },
        body: JSON.stringify({ ...queryBody, statuses: group.statuses, inboxUuids: [B3_INBOX_UUIDS.supportCenter, B3_INBOX_UUIDS.emailSupport] }),
        signal: AbortSignal.timeout(15_000),
      });
      requests += 1;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('B3 Networks rejected the session. Renew it from Session / cURL.');
        throw new Error(`B3 Networks query failed (HTTP ${response.status}).`);
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('B3 Networks returned an invalid ticket page.');
      for (const record of payload) {
        const ticket = normalizeB3InboxTicket(record, memberMap);
        if (ticket) ticketMap.set(ticket.txnUuid, ticket);
      }
      onProgress?.({ statusGroup: group.label, page, requests, recordsRetrieved: ticketMap.size });
      if (payload.length === 0) break;
    }
  }

  // Enrich tickets missing createdByName or ticket number (SID) with their caseInfo details (Support Center and Email Support)
  const ticketsToEnrich = [...ticketMap.values()].filter((ticket) =>
    !ticket.createdByName || !ticket.sid
  );

  if (ticketsToEnrich.length > 0) {
    const CONCURRENCY = 10;
    for (let i = 0; i < ticketsToEnrich.length; i += CONCURRENCY) {
      const batch = ticketsToEnrich.slice(i, i + CONCURRENCY);
      const enrichedBatch = await Promise.all(
        batch.map((ticket) => fetchB3TicketDetail(ticket.txnUuid, credentials, memberMap, fetcher))
      );
      for (const detailed of enrichedBatch) {
        if (detailed) {
          const existing = ticketMap.get(detailed.txnUuid);
          ticketMap.set(detailed.txnUuid, {
            ...existing,
            ...detailed,
            customer: detailed.customer || existing?.customer || '',
            title: detailed.title || existing?.title || '',
            assignees: detailed.assignees ?? existing?.assignees ?? null,
          });
        }
      }
      requests += batch.length;
      onProgress?.({
        statusGroup: 'waiting / assigned',
        page: Math.ceil((i + batch.length) / CONCURRENCY),
        requests,
        recordsRetrieved: ticketMap.size,
      });
    }
  }

  return { tickets: [...ticketMap.values()], requests, recordsRetrieved: ticketMap.size };
}

export async function fastPollB3InboxTickets(
  credentials: B3Credentials,
  fetcher: typeof fetch = fetch,
): Promise<{ success: boolean; newTickets?: B3InboxTicketRecord[]; error?: string }> {
  try {
    const requestUrl = new URL(B3_QUERY_ENDPOINT);
    requestUrl.searchParams.set('page', '1');
    requestUrl.searchParams.set('perPage', '25');

    const response = await fetcher(requestUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        cookie: `sessionToken=${credentials.sessionToken}`,
        origin: 'https://portal.b3networks.com',
        referer: 'https://portal.b3networks.com/apps/unifiedworkspace/1.1.1rc2/',
        'x-user-org-uuid': credentials.orgUuid,
      },
      body: JSON.stringify({
        statuses: ['waiting'],
        inboxUuids: [B3_INBOX_UUIDS.supportCenter, B3_INBOX_UUIDS.emailSupport],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { success: false, error: 'Invalid response from B3' };

    const records: B3InboxTicketRecord[] = [];
    for (const record of payload) {
      const ticket = normalizeB3InboxTicket(record);
      if (ticket) records.push(ticket);
    }
    return { success: true, newTickets: records };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fast poll failed' };
  }
}

export async function syncAndCommitB3InboxCache(
  fetchTickets: () => Promise<B3SyncResult>,
  readCache: () => B3InboxCacheSnapshot,
  writeCache: (cache: B3InboxCacheSnapshot) => void,
  now: () => Date = () => new Date(),
): Promise<{ success: boolean; cache: B3InboxCacheSnapshot; result?: B3SyncResult; error?: string }> {
  const previous = readCache();
  try {
    const result = await fetchTickets();
    const cache = { tickets: result.tickets, lastSuccessfulSyncAt: now().toISOString() };
    writeCache(cache);
    return { success: true, cache, result };
  } catch (error) {
    return {
      success: false,
      cache: previous,
      error: error instanceof Error ? error.message : 'B3 inbox synchronization failed.',
    };
  }
}