import { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-4 mb-3',
        className,
      )}
      {...props}
    />
  )
}
