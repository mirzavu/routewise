export default function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand supplied-brand" onClick={onClick} aria-label="RouteWise home">
      <img src="/routewise-logo.png" alt="RouteWise — Smarter Routes. Safer Deliveries." />
    </button>
  )
}
