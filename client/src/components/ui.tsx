import { InputHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-block">
      <span className="font-display text-xl text-ink">SignedOut</span>
      <span className="signature-line mt-1" />
    </Link>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, id, ...props }: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        className="w-full border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-stone/60 focus:border-laurel focus:outline-none"
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center px-5 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-laurel text-white hover:bg-laurel-dark'
      : 'border border-line bg-white text-ink hover:border-laurel hover:text-laurel';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border border-danger/30 bg-white px-3.5 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}
