export default function ScreenHeader({ eyebrow, title, description }) {
  return (
    <header className="screen-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p className="description">{description}</p> : null}
    </header>
  );
}
