import { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded', className)}
      {...props}
    />
  )
}
