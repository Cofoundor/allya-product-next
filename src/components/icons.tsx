/* The prototype's inline SVGs, as components. Sizing lives in CSS
   except where a glyph is used at a one-off size. */

export function ArrowIcon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path
        d="M4 12h15M13 6l6 6-6 6"
        stroke="#0a0a0a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Back, one level up. Unlike ArrowIcon this inherits its colour, because it
   sits on the page's own surface rather than on an accent button. */
export function BackIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* An intrinsic size matters here: an <svg> with no width/height stretches to
   fill whatever box it lands in, which is how this turned into a 100px tick
   in the onboarding ledger. Callers can still size it up. */
export function TickIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none">
      <path
        d="M2 6.2l2.6 2.6L10 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PersonIcon({ size = 11 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 8.5a6.5 6.5 0 0 1 13 0"
        stroke="#e7c98a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PaperclipIcon({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path
        d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l9-9a3.5 3.5 0 014.9 4.9l-9 9a2 2 0 01-2.8-2.8l8.1-8.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="12" rx="3" stroke="#91d45f" strokeWidth="1.7" />
      <circle cx="9" cy="12" r="1.4" fill="#91d45f" />
      <circle cx="15" cy="12" r="1.4" fill="#91d45f" />
      <path d="M12 3v3" stroke="#91d45f" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ExpertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 11Zm-6 8.2a6 6 0 0 1 12 0"
        stroke="#e7c98a"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
