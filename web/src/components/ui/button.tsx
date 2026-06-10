'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[hsl(var(--color-primary))] text-white shadow-md hover:bg-[hsl(var(--color-primary-hover))] hover:shadow-lg focus-visible:ring-[hsl(var(--color-primary))]',
        secondary:
          'bg-[hsl(var(--color-secondary))] text-white shadow-md hover:bg-[hsl(var(--color-secondary-hover))] hover:shadow-lg focus-visible:ring-[hsl(var(--color-secondary))]',
        outline:
          'border-2 border-[hsl(var(--border-default))] bg-transparent hover:bg-[hsl(var(--bg-tertiary))] hover:border-[hsl(var(--border-hover))]',
        ghost:
          'hover:bg-[hsl(var(--bg-tertiary))] hover:text-[hsl(var(--text-primary))]',
        danger:
          'bg-[hsl(var(--color-error))] text-white shadow-md hover:opacity-90 focus-visible:ring-[hsl(var(--color-error))]',
        link: 'text-[hsl(var(--color-primary))] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs gap-1.5',
        md: 'h-10 px-4 text-sm gap-2',
        lg: 'h-12 px-6 text-base gap-2.5',
        xl: 'h-14 px-8 text-lg gap-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
