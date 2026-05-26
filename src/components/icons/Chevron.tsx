export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
