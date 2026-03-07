/**
 * Video model default request parameters.
 *
 * Each entry maps a model key (provider::modelId) to the default parameters
 * that should be sent to the external API when no user overrides are provided.
 *
 * `imageParamName` indicates the correct image parameter name for each model.
 */

export interface VideoModelDefaults {
  imageParamName: string
  lastFrameParamName?: string
  negative_prompt?: string
  guidance_scale?: number
  cfg_scale?: number
  duration?: number | string
  aspect_ratio?: string
  resolution?: string
  generate_audio?: boolean
  enable_prompt_expansion?: boolean
  delete_video?: boolean
  prompt_optimizer?: boolean
  concepts?: string[]
  [key: string]: unknown
}

const VIDEO_MODEL_DEFAULTS: Record<string, VideoModelDefaults> = {

  // ===== Replicate models =====

  'replicate::replicate-kling26': {
    imageParamName: 'start_image',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    duration: 5,
  },

  'replicate::replicate-kling25': {
    imageParamName: 'start_image',
    lastFrameParamName: 'end_image',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    guidance_scale: 0.5,
    duration: 5,
  },

  'replicate::replicate-veo31': {
    imageParamName: 'image',
    lastFrameParamName: 'last_frame',
    duration: 8,
    negative_prompt: 'blur, distort, low quality',
    generate_audio: false,
    resolution: '1080p',
  },

  'replicate::replicate-veo3': {
    imageParamName: 'image',
    duration: 8,
    negative_prompt: 'blur, distort, low quality',
    generate_audio: false,
  },

  'replicate::replicate-wan26': {
    imageParamName: 'image',
    duration: 5,
    resolution: '1080p',
    negative_prompt: 'blur, distort, low quality, static, frozen, no movement',
    enable_prompt_expansion: false,
  },

  'replicate::replicate-hailuo': {
    imageParamName: 'first_frame_image',
    duration: 6,
    resolution: '1080p',
  },

  'replicate::replicate-ray2': {
    imageParamName: 'start_image',
    lastFrameParamName: 'end_image',
    duration: 5,
  },

  'replicate::replicate-gen4': {
    imageParamName: 'image',
    duration: 10,
  },

  // ===== FAL models =====

  'fal::fal-wan25': {
    imageParamName: 'image_url',
    duration: '5',
    resolution: '1080p',
    negative_prompt: 'blur, distort, low quality, static, frozen, no movement',
    enable_prompt_expansion: false,
  },

  'fal::fal-veo31': {
    imageParamName: 'image_url',
    duration: '8s',
    generate_audio: false,
    resolution: '1080p',
  },

  'fal::fal-sora2': {
    imageParamName: 'image_url',
    duration: 4,
    delete_video: false,
  },

  'fal::fal-ai/kling-video/v2.5-turbo/pro/image-to-video': {
    imageParamName: 'image_url',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    cfg_scale: 0.5,
    duration: '5',
  },

  'fal::fal-ai/kling-video/v3/standard/image-to-video': {
    imageParamName: 'start_image_url',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    cfg_scale: 0.5,
    duration: '5',
    generate_audio: false,
  },

  'fal::fal-ai/kling-video/v3/pro/image-to-video': {
    imageParamName: 'start_image_url',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    cfg_scale: 0.5,
    duration: '5',
    generate_audio: false,
  },

  // ===== ARK (Volcano / Doubao) models =====

  'ark::doubao-seedance-1-0-pro-250528': {
    imageParamName: 'image_url',
    duration: 5,
    resolution: '720p',
  },

  'ark::doubao-seedance-1-0-pro-fast-251015': {
    imageParamName: 'image_url',
    duration: 5,
    resolution: '720p',
  },

  'ark::doubao-seedance-1-0-lite-i2v-250428': {
    imageParamName: 'image_url',
    duration: 5,
    resolution: '720p',
  },

  'ark::doubao-seedance-1-5-pro-251215': {
    imageParamName: 'image_url',
    duration: 5,
    resolution: '720p',
  },

  // ===== Google Veo models =====

  'google::veo-3.1-generate-preview': {
    imageParamName: 'image',
    duration: 8,
    resolution: '720p',
  },

  'google::veo-3.1-fast-generate-preview': {
    imageParamName: 'image',
    duration: 8,
    resolution: '720p',
  },

  'google::veo-3.0-generate-001': {
    imageParamName: 'image',
    duration: 8,
  },

  'google::veo-3.0-fast-generate-001': {
    imageParamName: 'image',
    duration: 8,
  },

  'google::veo-2.0-generate-001': {
    imageParamName: 'image',
    duration: 5,
  },

  // ===== MiniMax (Hailuo) models =====

  'minimax::minimax-hailuo-2.3': {
    imageParamName: 'first_frame_image',
    duration: 6,
    resolution: '1080p',
  },

  'minimax::minimax-hailuo-02': {
    imageParamName: 'first_frame_image',
    duration: 6,
  },

  // ===== Vidu models =====

  'vidu::viduq3-pro': {
    imageParamName: 'image',
    duration: 5,
    resolution: '720p',
  },

  'vidu::viduq2-pro': {
    imageParamName: 'image',
    duration: 5,
    resolution: '720p',
  },

  'vidu::viduq2-turbo': {
    imageParamName: 'image',
    duration: 5,
    resolution: '720p',
  },
}

const FALLBACK_DEFAULTS: VideoModelDefaults = {
  imageParamName: 'image_url',
  duration: 5,
}

export function getVideoModelDefaults(modelKey: string): VideoModelDefaults {
  return VIDEO_MODEL_DEFAULTS[modelKey] ?? FALLBACK_DEFAULTS
}

export function hasVideoModelDefaults(modelKey: string): boolean {
  return modelKey in VIDEO_MODEL_DEFAULTS
}
