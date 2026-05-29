import React from 'react'
import { cn } from '@/utils/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'secondary'
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

    const variantStyles = {
      default: 'bg-[#10375c] text-white',
      outline: 'border border-[#10375c]/30 text-[#10375c]',
      secondary: 'bg-[#10375c]/10 text-[#10375c]',
    }

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        {...props}
      />
    )
  },
)

Badge.displayName = 'Badge'
