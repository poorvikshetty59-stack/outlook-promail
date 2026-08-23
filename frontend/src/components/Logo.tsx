export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><svg aria-hidden="true" viewBox="0 0 36 36" className="logo-icon"><path d="M7 11.5A4.5 4.5 0 0 1 11.5 7h13A4.5 4.5 0 0 1 29 11.5v8A4.5 4.5 0 0 1 24.5 24H17l-5.5 5v-5h0A4.5 4.5 0 0 1 7 19.5v-8Z" /><path d="m11 12 7 5 7-5" /></svg>{!compact && <span>Promail</span>}</div>;
}
