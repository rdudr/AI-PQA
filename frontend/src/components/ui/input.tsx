import * as React from 'react'

import { cn } from '@/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-[#10375c]/12 bg-white/70 px-3 py-2 text-sm text-[#10375c] shadow-inner outline-none transition placeholder:text-[#10375c]/40 focus-visible:ring-2 focus-visible:ring-[#f3c623]/60 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
