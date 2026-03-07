/**
 * Builds a faithful preview of the video generation request body.
 *
 * This module replicates the exact request body construction logic from each
 * generator (replicate.ts, fal.ts, ark.ts, minimax.ts, vidu.ts, google.ts,
 * openai-compatible.ts) so the user sees what will actually be sent.
 *
 * Data flow in production:
 *   worker → resolveVideoSourceFromGeneration → generateVideo → generator.doGenerate
 *
 * The generator receives: { userId, imageUrl, prompt, options: { ...providerOptions, provider, modelId, modelKey } }
 * Each generator then builds a provider-specific `input` object.
 */

import { parseModelKeyStrict } from '@/lib/model-config-contract'

export interface VideoRequestPreview {
  provider: string
  modelId: string
  modelKey: string
  endpoint: string
  input: Record<string, unknown>
}

interface PreviewContext {
  modelKey: string
  prompt: string
  videoRatio?: string
  generationOptions?: Record<string, string | number | boolean>
}

// ============================================================
// Replicate
// ============================================================

const REPLICATE_VIDEO_ENDPOINTS: Record<string, string> = {
  'replicate-veo31': 'google/veo-3.1',
  'replicate-veo3': 'google/veo-3',
  'replicate-wan26': 'wan-video/wan-2.6-i2v',
  'replicate-kling25': 'kwaivgi/kling-v2.5-turbo-pro',
  'replicate-kling26': 'kwaivgi/kling-v2.6',
  'replicate-hailuo': 'minimax/hailuo-2.3',
  'replicate-ray2': 'luma/ray-2-720p',
  'replicate-gen4': 'runwayml/gen4-turbo',
}

const REPLICATE_VIDEO_IMAGE_PARAM: Record<string, string> = {
  'replicate-veo31': 'image',
  'replicate-veo3': 'image',
  'replicate-wan26': 'image',
  'replicate-kling25': 'start_image',
  'replicate-kling26': 'start_image',
  'replicate-hailuo': 'first_frame_image',
  'replicate-ray2': 'start_image',
  'replicate-gen4': 'image',
}

const REPLICATE_VIDEO_LAST_FRAME_PARAM: Record<string, string> = {
  'replicate-kling25': 'end_image',
  'replicate-ray2': 'end_image',
  'replicate-veo31': 'last_frame',
}

function buildReplicateInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const endpoint = REPLICATE_VIDEO_ENDPOINTS[modelId]
  if (!endpoint) return null

  const imageParamName = REPLICATE_VIDEO_IMAGE_PARAM[modelId] || 'image_url'
  const lastFrameParamName = REPLICATE_VIDEO_LAST_FRAME_PARAM[modelId]
  const duration = generationOptions.duration
  const input: Record<string, unknown> = {
    [imageParamName]: '<base64_image>',
  }
  if (lastFrameParamName) {
    input[lastFrameParamName] = '<last_frame_image> (optional)'
  }
  if (prompt) input.prompt = prompt
  if (typeof duration === 'number') input.duration = duration
  if (aspectRatio) input.aspect_ratio = aspectRatio

  return { endpoint, input }
}

// ============================================================
// FAL
// ============================================================

const FAL_VIDEO_ENDPOINTS: Record<string, string> = {
  'fal-wan25': 'wan/v2.6/image-to-video',
  'fal-veo31': 'fal-ai/veo3.1/fast/image-to-video',
  'fal-sora2': 'fal-ai/sora-2/image-to-video',
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'fal-ai/kling-video/v3/standard/image-to-video': 'fal-ai/kling-video/v3/standard/image-to-video',
  'fal-ai/kling-video/v3/pro/image-to-video': 'fal-ai/kling-video/v3/pro/image-to-video',
}

function buildFalInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const endpoint = FAL_VIDEO_ENDPOINTS[modelId]
  if (!endpoint) return null

  const duration = generationOptions.duration
  const resolution = generationOptions.resolution as string | undefined

  let input: Record<string, unknown>

  switch (modelId) {
    case 'fal-wan25':
      input = {
        image_url: '<base64_image>',
        prompt,
        ...(resolution ? { resolution } : {}),
        ...(typeof duration === 'number' ? { duration: String(duration) } : {}),
      }
      break
    case 'fal-veo31':
      input = {
        image_url: '<base64_image>',
        prompt,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(typeof duration === 'number' ? { duration: `${duration}s` } : {}),
        generate_audio: false,
      }
      break
    case 'fal-sora2':
      input = {
        image_url: '<base64_image>',
        prompt,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(typeof duration === 'number' ? { duration } : {}),
        delete_video: false,
      }
      break
    case 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video':
      input = {
        image_url: '<base64_image>',
        prompt,
        ...(typeof duration === 'number' ? { duration: String(duration) } : {}),
        negative_prompt: 'blur, distort, and low quality',
        cfg_scale: 0.5,
      }
      break
    case 'fal-ai/kling-video/v3/standard/image-to-video':
    case 'fal-ai/kling-video/v3/pro/image-to-video':
      input = {
        start_image_url: '<base64_image>',
        prompt,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(typeof duration === 'number' ? { duration: String(duration) } : {}),
        generate_audio: false,
      }
      break
    default:
      return null
  }

  return { endpoint, input }
}

// ============================================================
// ARK (Volcano / Seedance)
// ============================================================

function buildArkInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  // Strip -batch suffix for real model
  const realModel = modelId.endsWith('-batch') ? modelId.replace('-batch', '') : modelId
  const isBatchMode = modelId.endsWith('-batch')

  const knownModels = [
    'doubao-seedance-1-0-pro-250528',
    'doubao-seedance-1-0-pro-fast-251015',
    'doubao-seedance-1-0-lite-i2v-250428',
    'doubao-seedance-1-5-pro-251215',
  ]
  if (!knownModels.includes(realModel)) return null

  const resolution = generationOptions.resolution as string | undefined
  const duration = generationOptions.duration
  const generateAudio = generationOptions.generateAudio

  const content: unknown[] = []
  if (prompt.trim()) {
    content.push({ type: 'text', text: prompt })
  }
  content.push({
    type: 'image_url',
    image_url: { url: '<base64_image>' },
  })

  const body: Record<string, unknown> = {
    model: realModel,
    content,
  }

  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') {
    body.resolution = resolution
  }
  if (aspectRatio) {
    body.ratio = aspectRatio
  }
  if (typeof duration === 'number') {
    body.duration = duration
  }
  if (isBatchMode) {
    body.service_tier = 'flex'
    body.execution_expires_after = 86400
  }
  if (typeof generateAudio === 'boolean') {
    body.generate_audio = generateAudio
  }

  return { endpoint: 'ark/video_generation', input: body }
}

// ============================================================
// MiniMax (Hailuo)
// ============================================================

const MINIMAX_API_MODEL_MAP: Record<string, string> = {
  'minimax-hailuo-2.3': 'MiniMax-Hailuo-2.3',
  'minimax-hailuo-2.3-fast': 'MiniMax-Hailuo-2.3-Fast',
  'minimax-hailuo-02': 'MiniMax-Hailuo-02',
  't2v-01': 'T2V-01',
  't2v-01-director': 'T2V-01-Director',
}

function buildMinimaxInput(
  modelId: string,
  prompt: string,
  _aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const apiModel = MINIMAX_API_MODEL_MAP[modelId]
  if (!apiModel) return null

  const duration = generationOptions.duration
  const resolution = generationOptions.resolution as string | undefined

  const body: Record<string, unknown> = {
    model: apiModel,
    prompt,
    prompt_optimizer: true,
  }
  if (typeof duration === 'number') {
    body.duration = duration
  }
  if (resolution) {
    // Normalize: minimax uses uppercase like '768P', '1080P'
    const normalized = resolution.trim().toUpperCase()
    body.resolution = normalized.endsWith('P') ? normalized : `${normalized}P`
  }
  // Image input for models that support it
  const supportsImage = modelId.startsWith('minimax-hailuo')
  if (supportsImage) {
    body.first_frame_image = '<base64_image>'
  }

  return { endpoint: 'minimax/video_generation', input: body }
}

// ============================================================
// Vidu
// ============================================================

function buildViduInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const knownModels = [
    'viduq3-pro', 'viduq2-pro-fast', 'viduq2-pro', 'viduq2-turbo',
    'viduq1', 'viduq1-classic', 'vidu2.0',
  ]
  if (!knownModels.includes(modelId)) return null

  const duration = generationOptions.duration
  const resolution = generationOptions.resolution as string | undefined
  const generateAudio = generationOptions.generateAudio

  const body: Record<string, unknown> = {
    model: modelId,
    images: ['<base64_image>'],
    duration: typeof duration === 'number' ? duration : 5,
    resolution: resolution || '720p',
  }
  if (prompt) {
    body.prompt = prompt
  }
  if (aspectRatio) {
    body.aspect_ratio = aspectRatio
  }
  if (typeof generateAudio === 'boolean') {
    body.audio = generateAudio
  }

  return { endpoint: 'vidu/img2video', input: body }
}

// ============================================================
// Google Veo (direct)
// ============================================================

function buildGoogleInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const knownModels = [
    'veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview',
    'veo-3.0-generate-001', 'veo-3.0-fast-generate-001',
    'veo-2.0-generate-001',
  ]
  if (!knownModels.includes(modelId)) return null

  const duration = generationOptions.duration
  const resolution = generationOptions.resolution as string | undefined

  const config: Record<string, unknown> = {}
  if (aspectRatio) config.aspectRatio = aspectRatio
  if (resolution) config.resolution = resolution
  if (typeof duration === 'number') config.durationSeconds = duration

  const body: Record<string, unknown> = {
    model: modelId,
    image: { mimeType: 'image/jpeg', imageBytes: '<base64>' },
  }
  if (prompt) {
    body.prompt = prompt
  }
  if (Object.keys(config).length > 0) {
    body.config = config
  }

  return { endpoint: `google/${modelId}`, input: body }
}

// ============================================================
// OpenAI-Compatible (Sora)
// ============================================================

function buildOpenAICompatibleInput(
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
): { endpoint: string; input: Record<string, unknown> } | null {
  const knownModels = ['sora-2']
  if (!knownModels.includes(modelId)) return null

  const duration = generationOptions.duration
  const resolution = generationOptions.resolution as string | undefined

  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
    input_reference: '<image_file>',
  }
  if (typeof duration === 'number') {
    body.seconds = String(duration)
  }
  // Sora uses pixel size — resolve from resolution or aspectRatio
  const isPortrait = aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio === '2:3'
  if (resolution === '1080p') {
    body.size = isPortrait ? '1024x1792' : '1792x1024'
  } else if (resolution === '720p') {
    body.size = isPortrait ? '720x1280' : '1280x720'
  } else if (aspectRatio === '9:16') {
    body.size = '720x1280'
  } else if (aspectRatio === '16:9') {
    body.size = '1280x720'
  }

  return { endpoint: 'openai/v1/videos', input: body }
}

// ============================================================
// Public API
// ============================================================

type ProviderBuilder = (
  modelId: string,
  prompt: string,
  aspectRatio: string | undefined,
  generationOptions: Record<string, string | number | boolean>,
) => { endpoint: string; input: Record<string, unknown> } | null

const PROVIDER_BUILDERS: Record<string, ProviderBuilder> = {
  replicate: buildReplicateInput,
  fal: buildFalInput,
  ark: buildArkInput,
  minimax: buildMinimaxInput,
  vidu: buildViduInput,
  google: buildGoogleInput,
  openai: buildOpenAICompatibleInput,
}

export function buildVideoRequestPreview(ctx: PreviewContext): VideoRequestPreview | null {
  const parsed = parseModelKeyStrict(ctx.modelKey)
  if (!parsed) return null

  const { provider, modelId } = parsed
  const builder = PROVIDER_BUILDERS[provider]
  if (!builder) return null

  const generationOptions = ctx.generationOptions ?? {}
  const aspectRatio = ctx.videoRatio || (generationOptions.aspectRatio as string | undefined)

  const result = builder(modelId, ctx.prompt, aspectRatio, generationOptions)
  if (!result) return null

  return {
    provider,
    modelId,
    modelKey: ctx.modelKey,
    endpoint: result.endpoint,
    input: result.input,
  }
}

/**
 * Format preview as a JSON string for display/copy.
 */
export function formatPreviewAsJson(preview: VideoRequestPreview): string {
  return JSON.stringify(preview.input, null, 2)
}

/**
 * Compact summary for collapsed state.
 */
export function formatPreviewSummary(preview: VideoRequestPreview): string {
  const paramCount = Object.keys(preview.input).length
  return `${preview.endpoint} | ${paramCount} params`
}
