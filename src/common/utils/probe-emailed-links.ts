/**
 * Pages the API links to from emails. If the portal served at FRONTEND_URL doesn't
 * have them (an older build, or the wrong host), every emailed link 404s.
 */
export const EMAILED_LINK_PATHS = ['/verify-email', '/reset-password/confirm'];

export interface LinkProbeResult {
  path: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

type FetchLike = (
  url: string,
  init?: { redirect?: 'follow'; signal?: AbortSignal },
) => Promise<{ status: number }>;

export async function probeEmailedLinks(
  baseUrl: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 8000,
): Promise<LinkProbeResult[]> {
  const root = baseUrl.trim().replace(/\/+$/, '');
  return Promise.all(
    EMAILED_LINK_PATHS.map(async (path): Promise<LinkProbeResult> => {
      try {
        const response = await fetchImpl(`${root}${path}`, {
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });
        return { path, status: response.status, ok: response.status < 400 };
      } catch (error) {
        return {
          path,
          status: null,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

/** A human-readable problem statement, or null when every link resolves. */
export function describeLinkProblems(
  baseUrl: string,
  results: LinkProbeResult[],
): string | null {
  const failing = results.filter((result) => !result.ok);
  if (failing.length === 0) return null;
  const detail = failing
    .map((r) => `${r.path} → ${r.status ?? r.error ?? 'no response'}`)
    .join('; ');
  return (
    `Emailed links will not work: ${detail} at ${baseUrl}. Deploy the current portal build to that host, ` +
    `or point FRONTEND_URL at the portal that talks to this API.`
  );
}
