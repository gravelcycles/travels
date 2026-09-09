// One short-lived, single-use PKCE grant per Durable Object. No photo bytes or passwords.
import { DurableObject } from 'cloudflare:workers';
export class PhotoAuthCode extends DurableObject {
  constructor(state, env) { super(state, env); this.storage = state.storage; }
  async fetch(request) {
    const data = await request.json();
    if (new URL(request.url).pathname === '/create') {
      await this.storage.put('grant', data);
      await this.storage.setAlarm(data.exp * 1000);
      return Response.json({ ok: true });
    }
    const grant = await this.storage.transaction(async storage => {
      const value = await storage.get('grant');
      if (!value || value.exp <= Math.floor(Date.now()/1000) || value.origin !== data.origin || value.challenge !== data.challenge) return null;
      await storage.delete('grant');return value;
    });
    return Response.json(grant, { status: grant ? 200 : 401 });
  }
  async alarm() { await this.storage.deleteAll(); }
}
