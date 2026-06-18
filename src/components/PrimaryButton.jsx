export default function PrimaryButton({ children, onClick, variant = 'primary', disabled = false }) {
  return (
    <button className={`btn btn-${variant}`} type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
