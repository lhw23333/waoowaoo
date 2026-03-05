import { createScopedLogger, logError as _ulogError } from '@/lib/logging/core'
/**
 * Replicate 生成器（图像 + 视频）
 *
 * 通过 Replicate API（或兼容网关如 UniAPI）提交异步预测任务。
 *
 * 图像模型：
 * - replicate-banana-2  -> google/nano-banana-2
 * - replicate-banana-pro -> google/nano-banana-pro
 * - replicate-imagen4   -> google/imagen-4
 * - replicate-imagen4-fast -> google/imagen-4-fast
 * - replicate-flux-pro  -> black-forest-labs/flux-1.1-pro
 * - replicate-flux-kontext -> black-forest-labs/flux-kontext-pro
 * - replicate-recraft-v4 -> recraft-ai/recraft-v4
 *
 * 视频模型：
 * - replicate-veo31     -> google/veo-3.1
 * - replicate-veo3      -> google/veo-3
 * - replicate-wan26     -> wan-video/wan-2.6-i2v
 * - replicate-kling25   -> kwaivgi/kling-v2.5-turbo-pro
 * - replicate-kling26   -> kwaivgi/kling-v2.6
 * - replicate-hailuo    -> minimax/hailuo-2.3
 * - replicate-ray2      -> luma/ray-2-720p
 * - replicate-gen4      -> runwayml/gen4-turbo
 */

import {
    BaseImageGenerator,
    BaseVideoGenerator,
    ImageGenerateParams,
    VideoGenerateParams,
    GenerateResult,
} from './base'
import { getProviderConfig } from '@/lib/api-config'
import { submitReplicateTask } from '@/lib/async-submit'

// ============================================================
// 图像模型端点映射（modelId → owner/model）
// ============================================================

const REPLICATE_IMAGE_ENDPOINTS: Record<string, string> = {
    'replicate-banana-2': 'google/nano-banana-2',
    'replicate-banana-pro': 'google/nano-banana-pro',
    'replicate-imagen4': 'google/imagen-4',
    'replicate-imagen4-fast': 'google/imagen-4-fast',
    'replicate-flux-pro': 'black-forest-labs/flux-1.1-pro',
    'replicate-flux-kontext': 'black-forest-labs/flux-kontext-pro',
    'replicate-recraft-v4': 'recraft-ai/recraft-v4',
}

// ============================================================
// 视频模型端点映射（modelId → owner/model）
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

/**
 * 将 "owner/model" 拆分为 { owner, model }
 */
function parseReplicateEndpoint(endpoint: string): { owner: string; model: string } {
    const slashIndex = endpoint.indexOf('/')
    if (slashIndex === -1) {
        throw new Error(`REPLICATE_ENDPOINT_INVALID: ${endpoint}`)
    }
    return {
        owner: endpoint.slice(0, slashIndex),
        model: endpoint.slice(slashIndex + 1),
    }
}

// ============================================================
// Replicate 图像生成器
// ============================================================

export class ReplicateImageGenerator extends BaseImageGenerator {
    constructor(private modelId?: string) {
        super()
    }

    protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
        const { userId, prompt, referenceImages = [], options = {} } = params

        const providerConfig = await getProviderConfig(userId, 'replicate')
        const { apiKey, baseUrl } = providerConfig

        const {
            aspectRatio,
            resolution,
            outputFormat = 'png',
            modelId: optModelId,
        } = options as {
            aspectRatio?: string
            resolution?: string
            outputFormat?: string
            modelId?: string
            provider?: string
            modelKey?: string
        }

        const effectiveModelId = optModelId || this.modelId || 'replicate-banana-2'
        const endpoint = REPLICATE_IMAGE_ENDPOINTS[effectiveModelId]
        if (!endpoint) {
            throw new Error(`REPLICATE_IMAGE_MODEL_UNSUPPORTED: ${effectiveModelId}`)
        }

        const { owner, model } = parseReplicateEndpoint(endpoint)

        const logger = createScopedLogger({
            module: 'worker.replicate-image',
            action: 'replicate_image_generate',
        })
        logger.info({
            message: 'Replicate image generation request',
            details: {
                modelId: effectiveModelId,
                endpoint,
                referenceImagesCount: referenceImages.length,
            },
        })

        // 构建输入参数
        const input: Record<string, unknown> = { prompt }
        if (aspectRatio) input.aspect_ratio = aspectRatio
        if (resolution) input.resolution = resolution
        if (outputFormat) input.output_format = outputFormat
        if (referenceImages.length > 0) {
            input.image_url = referenceImages[0]
            if (referenceImages.length > 1) {
                input.image_urls = referenceImages
            }
        }

        try {
            const predictionId = await submitReplicateTask(owner, model, input, apiKey, baseUrl)
            logger.info({ message: 'Replicate image task submitted', details: { predictionId } })

            return {
                success: true,
                async: true,
                requestId: predictionId,
                endpoint,
                externalId: `REPLICATE:IMAGE:${endpoint}:${predictionId}`,
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '未知错误'
            _ulogError('[Replicate Image] 提交失败:', message)
            throw new Error(`Replicate 图片任务提交失败: ${message}`)
        }
    }
}

// ============================================================
// Replicate 视频生成器
// ============================================================

export class ReplicateVideoGenerator extends BaseVideoGenerator {
    constructor(private modelId?: string) {
        super()
    }

    protected async doGenerate(params: VideoGenerateParams): Promise<GenerateResult> {
        const { userId, imageUrl, prompt = '', options = {} } = params

        const providerConfig = await getProviderConfig(userId, 'replicate')
        const { apiKey, baseUrl } = providerConfig

        const {
            duration,
            aspectRatio,
            modelId = this.modelId || 'replicate-wan26',
        } = options as {
            duration?: number
            aspectRatio?: string
            modelId?: string
            provider?: string
            modelKey?: string
        }

        const endpoint = REPLICATE_VIDEO_ENDPOINTS[modelId]
        if (!endpoint) {
            throw new Error(`REPLICATE_VIDEO_MODEL_UNSUPPORTED: ${modelId}`)
        }

        const { owner, model } = parseReplicateEndpoint(endpoint)

        const vLogger = createScopedLogger({
            module: 'worker.replicate-video',
            action: 'replicate_video_generate',
        })
        vLogger.info({ message: 'Replicate video generation request', details: { modelId, endpoint } })

        // 构建输入参数
        const input: Record<string, unknown> = {
            image_url: imageUrl,
        }
        if (prompt) input.prompt = prompt
        if (typeof duration === 'number') input.duration = duration
        if (aspectRatio) input.aspect_ratio = aspectRatio

        try {
            const predictionId = await submitReplicateTask(owner, model, input, apiKey, baseUrl)
            vLogger.info({ message: 'Replicate video task submitted', details: { predictionId } })

            return {
                success: true,
                async: true,
                requestId: predictionId,
                endpoint,
                externalId: `REPLICATE:VIDEO:${endpoint}:${predictionId}`,
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '未知错误'
            _ulogError('[Replicate Video] 提交失败:', message)
            throw new Error(`Replicate 视频任务提交失败: ${message}`)
        }
    }
}
