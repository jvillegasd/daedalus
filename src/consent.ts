/**
 * The big consent frameworks ship a reject control with a stable id or class, so name those
 * first: they are exact, they work in any language, and they cost one querySelector each.
 * Everything else falls back to reading button labels.
 */
export const rejectSelectors = [
  '#onetrust-reject-all-handler',
  '.ot-pc-refuse-all-handler',
  '#CybotCookiebotDialogBodyButtonDecline',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
  '#didomi-notice-disagree-button',
  '.didomi-continue-without-agreeing',
  '.qc-cmp2-summary-buttons button[mode="secondary"]',
  '[data-testid="uc-deny-all-button"]',
  '[aria-label="Reject all" i]',
];

/**
 * Labels that mean "no". "Accept only necessary" exists too, so the necessary/essential
 * phrasings match anywhere in the string while reject/decline must start the label — a
 * button reading "we never reject your choices" is not the one to click.
 */
export const rejectLabel = /^\s*(reject|decline|refuse|disagree)\b|only (necessary|essential)|(necessary|essential)( cookies)? only|continue without/i;

/** The reject control on the page, or null. Framework selectors win over label guessing. */
export const findReject = (root: ParentNode): HTMLElement | null => {
  for (const selector of rejectSelectors) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  const labelled = [...root.querySelectorAll<HTMLElement>('button,input[type=button],input[type=submit],a[role=button]')]
    .find(b => rejectLabel.test(b.textContent || (b as HTMLInputElement).value || ''));
  return labelled ?? null;
};
