import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
let authenticated = false;
class FakeSessionClient {
  auth = { getUser: async () => ({ data: { user: authenticated ? { id: 'test-user' } : null } }) };
}
vi.mock('@supabase/ssr', () => ({ createServerClient: () => new FakeSessionClient() }));
const { updateSession } = await import('./middleware');
beforeEach(() => {
  authenticated = false;
});
describe('assistant API authentication middleware', () => {
  it('returns JSON instead of login HTML for unauthenticated API calls', async () => {
    const response = await updateSession(
      new NextRequest('http://localhost/api/assistant/messages'),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthorized' });
    expect(response.headers.get('location')).toBeNull();
  });
  it('clears expired auth cookies and returns an explicit API error', async () => {
    authenticated = true;
    const response = await updateSession(
      new NextRequest('http://localhost/api/assistant/conversations', {
        headers: { cookie: 'sb-test-auth-token=fake' },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('');
  });
  it('retains login redirects for ordinary pages', async () => {
    const response = await updateSession(new NextRequest('http://localhost/dashboard'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login');
  });
});
