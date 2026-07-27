import { escape } from './html';

// Strings (with their trailing colon when they are a key), literals, then numbers. Order
// matters: the string arm has to win, or a number inside a string would be coloured.
const token = /"(?:\\.|[^"\\])*"\s*:?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

const className = (t: string) => t.startsWith('"') ? (t.endsWith(':') ? 'k' : 's') : /^[a-z]/.test(t) ? 'b' : 'n';

/**
 * Pretty JSON as highlighted HTML. Escaping happens per fragment rather than up front,
 * because escaping first turns every `"` into `&quot;` and the tokenizer stops seeing strings.
 */
export const highlight = (json: string) => {
  let out = '', last = 0;
  for (const m of json.matchAll(token)) {
    out += escape(json.slice(last, m.index)) + `<span class="j-${className(m[0])}">${escape(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escape(json.slice(last));
};
