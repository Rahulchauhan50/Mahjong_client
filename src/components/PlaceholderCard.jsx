export default function PlaceholderCard({ title, subtitle, children }) {
  return (
    <section className="placeholder-card">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </section>
  );
}
