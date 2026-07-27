/**
 * The tags a comma-separated field adds to a list: trimmed, empties dropped, and never one
 * that is already there. Returns only what is new, so callers append rather than replace.
 */
export const parseTags = (input: string, existing: string[] = []) => {
  const added: string[] = [];
  for (const tag of (input || '').split(',').map(t => t.trim()))
    if (tag && !existing.includes(tag) && !added.includes(tag)) added.push(tag);
  return added;
};
