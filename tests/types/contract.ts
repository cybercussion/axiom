// Compile-time contract for Axiom's public API, checked by `npm test`
// (tools/types.test.js). Correct use must compile. Every @ts-expect-error line is
// a misuse the declarations must REJECT: if one ever compiles, the unused
// directive becomes an error and the check fails.
import { state } from '../../types/core/state.js';
import { router } from '../../types/core/router.js';
import { gateway, GatewayError } from '../../types/core/gateway.js';
import { auth } from '../../types/core/auth.js';
import { config } from '../../types/core/config.js';
import { BaseComponent } from '../../types/shared/base-component.js';

// ---- correct use compiles ------------------------------------------------------
const route: string | null = state.data.route;
state.data.route = 'home';
const volume: number = state.define('volume', { initial: 80, storage: localStorage, parse: (raw) => parseInt(raw, 10) });
const renamed = state.update<{ name: string }>('user', (u) => ({ ...u, name: 'x' }));
const rows: Promise<number[]> = state.query('rows', async () => [1, 2]);
state.notify('saved', 'success');
const off: () => void = state.subscribe(({ key, value }) => void [key, value]);
router.navigate('/dashboard');
const offNav = router.onNavigation((nav) => void nav?.phase);
const offMatch = router.onMatch(({ route: r, params }) => void [r, params.id]);
const flows = async () => {
  await gateway.get('/me', {}, { expect: 'json' });
  try {
    await gateway.post('/orders', { sku: 'a' });
  } catch (e) {
    if (e instanceof GatewayError) { const status: number | undefined = e.status; void status; }
  }
  await auth.init({ tokenStore: 'session', keepAlive: false });
  const token: string | null = await auth.getAccessToken();
  void token;
};
const basePath: string = config.BASE_PATH;
class Demo extends BaseComponent {
  render() { this.shadowRoot!.textContent = this._esc('<b>'); }
}

// ---- misuse does not compile ---------------------------------------------------
// @ts-expect-error — 'jsn' is not an expect mode
gateway.get('/me', {}, { expect: 'jsn' });
// @ts-expect-error — there is no cookie token store
auth.init({ tokenStore: 'cookie' });
// @ts-expect-error — route is string | null
state.data.route = 42;
// @ts-expect-error — notification types are a closed set
state.notify('x', 'fatal');
// @ts-expect-error — config is read-only
config.ENV = 'hacked';
// @ts-expect-error — router internals are not part of the contract
void router._navSeq;
// @ts-expect-error — auth internals are not part of the contract
void auth._refreshToken;
// @ts-expect-error — state internals are not part of the contract
void state._rebase;

void [route, volume, renamed, rows, off, offNav, offMatch, flows, basePath, Demo];
