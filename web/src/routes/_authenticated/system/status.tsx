import { createFileRoute } from '@tanstack/react-router'
import { SystemStatus } from '@/features/system/status'

export const Route = createFileRoute('/_authenticated/system/status')({
  component: SystemStatus,
})
