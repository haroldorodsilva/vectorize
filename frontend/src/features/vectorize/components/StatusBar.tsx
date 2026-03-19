import { Chip } from '@/shared/components/ui/Chip'
import type { VectorizeResponse } from '@/shared/types'

interface StatusBarProps {
  data: VectorizeResponse
}

export function StatusBar({ data }: StatusBarProps) {
  return (
    <div className="flex gap-1.5 flex-wrap pt-2 text-xs text-gray-500">
      <Chip>◆ {data.regions.length} regiões</Chip>
      <Chip>{data.width}×{data.height} px</Chip>
      <Chip>{data.processing_time_ms} ms</Chip>
    </div>
  )
}
