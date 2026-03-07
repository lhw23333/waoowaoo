'use client'

import { useState, useMemo, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'
import {
  buildVideoRequestPreview,
  formatPreviewAsJson,
  formatPreviewSummary,
} from '@/lib/video-prompt-engine/request-preview'

interface VideoRequestPreviewPanelProps {
  modelKey: string
  prompt: string
  videoRatio?: string
  generationOptions?: Record<string, string | number | boolean>
  t: (key: never) => string
}

export default function VideoRequestPreviewPanel({
  modelKey,
  prompt,
  videoRatio,
  generationOptions,
  t,
}: VideoRequestPreviewPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const preview = useMemo(
    () => buildVideoRequestPreview({ modelKey, prompt, videoRatio, generationOptions }),
    [modelKey, prompt, videoRatio, generationOptions],
  )

  const jsonString = useMemo(
    () => (preview ? formatPreviewAsJson(preview) : ''),
    [preview],
  )

  const handleCopy = useCallback(async () => {
    if (!jsonString) return
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available
    }
  }, [jsonString])

  if (!preview || !modelKey) return null

  const summary = formatPreviewSummary(preview)

  return (
    <div className="mt-2 border border-[var(--glass-stroke-base)] rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        className="flex items-center justify-between px-3 py-1.5 bg-[var(--glass-bg-muted)] hover:bg-[var(--glass-bg-muted)]/80 cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--glass-text-tertiary)]">
          <AppIcon
            name="chevronDown"
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="font-medium">{t('requestPreview.title' as never)}</span>
          {!expanded && (
            <span className="ml-1 text-[var(--glass-text-tertiary)]/70">{summary}</span>
          )}
        </div>
        {expanded && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleCopy()
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[var(--glass-text-tertiary)] hover:text-[var(--glass-tone-info-fg)] transition-colors rounded"
            title="Copy"
          >
            <AppIcon name="copy" className="w-3 h-3" />
            {copied ? t('requestPreview.copied' as never) : t('requestPreview.copy' as never)}
          </button>
        )}
      </div>

      {/* Expanded content - full JSON preview */}
      {expanded && (
        <div className="px-3 py-2">
          <div className="text-[10px] text-[var(--glass-text-tertiary)] mb-1.5">
            {preview.endpoint}
          </div>
          <pre className="text-[11px] font-mono text-[var(--glass-text-secondary)] whitespace-pre-wrap break-all bg-[var(--glass-bg-surface)] rounded p-2 border border-[var(--glass-stroke-base)] max-h-[240px] overflow-y-auto">
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  )
}
