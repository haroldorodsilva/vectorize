import { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium',
        className,
      )}
      {...props}
    />
  )
}
