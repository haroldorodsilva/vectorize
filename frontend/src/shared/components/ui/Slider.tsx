import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  valueDisplay?: string | number
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, valueDisplay, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-semibold flex items-baseline gap-1.5">
        {label}
        {valueDisplay !== undefined && (
          <span className="text-sm font-bold text-gray-900">{valueDisplay}</span>
        )}
      </label>
      <input
        ref={ref}
        type="range"
        className={cn('w-28 accent-blue-600 cursor-pointer', className)}
        {...props}
      />
    </div>
  ),
)
Slider.displayName = 'Slider'
