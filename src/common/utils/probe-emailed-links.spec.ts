import { describeLinkProblems, probeEmailedLinks } from './probe-emailed-links';

const fakeFetch = (statuses: Record<string, number | Error>) => async (url: string) => {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const outcome = statuses[path];
  if (outcome instanceof Error) throw outcome;
  return { status: outcome ?? 404 };
};

describe('probeEmailedLinks', () => {
  it('passes when both pages resolve, and tolerates a trailing slash on the base URL', async () => {
    const results = await probeEmailedLinks('https://portal.example/', fakeFetch({ '/verify-email': 200, '/reset-password/confirm': 200 }));
    expect(results.map((r) => r.ok)).toEqual([true, true]);
    expect(describeLinkProblems('https://portal.example', results)).toBe(null);
  });

  it('reports a 404 page (the stale-build case) with the path and status', async () => {
    const results = await probeEmailedLinks('https://portal.example', fakeFetch({ '/verify-email': 404, '/reset-password/confirm': 200 }));
    const message = describeLinkProblems('https://portal.example', results) as string;
    expect(message).toContain('/verify-email → 404');
    expect(message).not.toContain('/reset-password/confirm →');
  });

  it('reports an unreachable host without throwing', async () => {
    const results = await probeEmailedLinks('https://nowhere.invalid', fakeFetch({ '/verify-email': new Error('getaddrinfo ENOTFOUND'), '/reset-password/confirm': new Error('getaddrinfo ENOTFOUND') }));
    expect(results.every((r) => r.status === null && !r.ok)).toBe(true);
    expect(describeLinkProblems('https://nowhere.invalid', results)).toContain('ENOTFOUND');
  });
});
