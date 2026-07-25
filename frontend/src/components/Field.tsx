import React from 'react';

const base =
  'w-full rounded-lg border border-surface-700 bg-surface-800/80 px-3 py-2 text-sm text-surface-100 ' +
  'placeholder:text-surface-500 outline-none transition-colors duration-150 ' +
  'focus:border-primary-500 focus:ring-1 focus:ring-primary-500/40 disabled:opacity-50';

function Wrapper({ label, error, hint, children }: {
  label?: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-xs font-medium text-surface-400">{label}</label>}
      {children}
      {error && <p className="mt-1 text-xs text-danger-400">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-surface-500">{hint}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string;
}
export function Input({ label, error, hint, className = '', ...rest }: InputProps) {
  return (
    <Wrapper label={label} error={error} hint={hint}>
      <input className={`${base} ${error ? 'border-danger-500/60' : ''} ${className}`} {...rest} />
    </Wrapper>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string;
}
export function Textarea({ label, error, hint, className = '', ...rest }: TextareaProps) {
  return (
    <Wrapper label={label} error={error} hint={hint}>
      <textarea className={`${base} resize-none ${error ? 'border-danger-500/60' : ''} ${className}`} {...rest} />
    </Wrapper>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string;
}
export function Select({ label, error, hint, className = '', children, ...rest }: SelectProps) {
  return (
    <Wrapper label={label} error={error} hint={hint}>
      <select className={`${base} ${error ? 'border-danger-500/60' : ''} ${className}`} {...rest}>
        {children}
      </select>
    </Wrapper>
  );
}
