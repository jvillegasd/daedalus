export type Redirect = { url: string; statusCode?: number };
/**
 * A navigation reports itself twice — once on request, once with its status — so the second
 * report updates the entry the first one opened rather than appending a duplicate.
 */
export const reduceRedirect = (chain: Redirect[], url: string, statusCode?: number): Redirect[] =>
  chain.at(-1)?.url === url ? [...chain.slice(0, -1), { url, statusCode: statusCode ?? chain.at(-1)?.statusCode }] : [...chain, { url, statusCode }];
