import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text' | 'danger' | 'auth';
};

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: '',
  secondary: 'secondary-button',
  text: 'text-button',
  danger: 'danger-button',
  auth: 'auth-submit'
};

export function Button({ variant, className, ...props }: ButtonProps) {
  const classes = [variant ? variantClasses[variant] : '', className].filter(Boolean).join(' ');
  return <button className={classes || undefined} {...props} />;
}
