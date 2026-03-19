import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/shared/lib/utils'

export type ButtonVariant = 'primary' | 'outline' | 'success' | 'ghost'
export type ButtonSize    = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  active?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', active, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors',
        'whitespace-nowrap cursor-pointer disabled:cursor-wait',
        {
          // variants
          primary: 'bg-blue-600 text-white border-0 hover:bg-blue-700 disabled:bg-gray-400',
          outline: cn(
            'border border-gray-300 bg-white text-gray-800',
            'hover:bg-gray-50 hover:border-gray-400',
            active && 'bg-blue-50 border-blue-500 text-blue-600',
          ),
          success: 'bg-green-600 text-white border-green-600 hover:bg-green-700',
          ghost:   'border-0 bg-transparent text-gray-700 hover:bg-gray-100',
        }[variant],
        // sizes
        size === 'sm' ? 'text-xs px-2.5 py-1.5' : 'text-sm px-4 py-2',
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
