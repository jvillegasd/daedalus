export type Redirect = { url: string; statusCode?: number };
/**
 * A navigation reports itself twice — once on request, once with its status — so the second
 * report updates the entry the first one opened rather than appending a duplicate.
 */
export const reduceRedirect = (chain: Redirect[], url: string, statusCode?: number): Redirect[] =>
  chain.at(-1)?.url === url ? [...chain.slice(0, -1), { url, statusCode: statusCode ?? chain.at(-1)?.statusCode }] : [...chain, { url, statusCode }];

/**
 * The chain as text, for the clipboard. A hop the browser never reported a status for prints
 * as `---` rather than being dropped: the gap is the interesting part when a trace looks
 * wrong, and a line silently missing would hide it.
 */
export const redirectText = (chain: Redirect[]) =>
  chain.map((r, i) => `${i + 1}. ${r.statusCode ?? '---'}  ${r.url}`).join('\n');
