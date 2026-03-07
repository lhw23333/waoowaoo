# 视频模型请求体参考文档

> 本文档基于 `src/lib/video-prompt-engine/request-preview.ts` 自动生成，反映各 Generator 实际构建的请求体结构。
>
> 示例 prompt: `"少年睁大双眼躺在床上，直直望着屋顶"`
> 示例 videoRatio: `"16:9"`
> `<base64_image>` 表示面板图片经 Base64 编码后的 Data URL

---

## 1. Replicate 模型

Replicate 模型通过 UniAPI 代理网关提交异步预测任务。**各模型的图片参数名不同**，部分模型支持首尾帧模式。

### 1.1 Kling v2.6 (`replicate::replicate-kling26`)

**endpoint:** `kwaivgi/kling-v2.6`

```json
{
  "start_image": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `start_image` | 不支持尾帧

### 1.2 Kling v2.5 Turbo Pro (`replicate::replicate-kling25`)

**endpoint:** `kwaivgi/kling-v2.5-turbo-pro`

```json
{
  "start_image": "<base64_image>",
  "end_image": "<last_frame_image> (optional)",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `start_image` | 尾帧参数: `end_image` | 支持首尾帧模式

### 1.3 Veo 3.1 (`replicate::replicate-veo31`)

**endpoint:** `google/veo-3.1`

```json
{
  "image": "<base64_image>",
  "last_frame": "<last_frame_image> (optional)",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 8,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `image` | 尾帧参数: `last_frame` | 支持首尾帧模式

### 1.4 Veo 3 (`replicate::replicate-veo3`)

**endpoint:** `google/veo-3`

```json
{
  "image": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 8,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `image` | 不支持尾帧

### 1.5 Wan 2.6 I2V (`replicate::replicate-wan26`)

**endpoint:** `wan-video/wan-2.6-i2v`

```json
{
  "image": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `image` | 不支持尾帧

### 1.6 Hailuo 2.3 (`replicate::replicate-hailuo`)

**endpoint:** `minimax/hailuo-2.3`

```json
{
  "first_frame_image": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 6,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `first_frame_image` | 不支持尾帧 (Replicate 版)

### 1.7 Ray 2 720p (`replicate::replicate-ray2`)

**endpoint:** `luma/ray-2-720p`

```json
{
  "start_image": "<base64_image>",
  "end_image": "<last_frame_image> (optional)",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 5,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `start_image` | 尾帧参数: `end_image` | 支持首尾帧模式
> 注: `start_image_url` / `end_image_url` 已弃用

### 1.8 Gen4 Turbo (`replicate::replicate-gen4`)

**endpoint:** `runwayml/gen4-turbo`

```json
{
  "image": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": 10,
  "aspect_ratio": "16:9"
}
```

> 首帧参数: `image` | 不支持尾帧

---

## 2. FAL 模型

FAL 模型各自有不同的请求体结构，图片参数名和 duration 格式因模型而异。

### 2.1 Wan v2.6 I2V (`fal::fal-wan25`)

**endpoint:** `wan/v2.6/image-to-video`

```json
{
  "image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "resolution": "1080p",
  "duration": "5"
}
```

> 注意: duration 为字符串类型

### 2.2 Veo 3.1 Fast I2V (`fal::fal-veo31`)

**endpoint:** `fal-ai/veo3.1/fast/image-to-video`

```json
{
  "image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9",
  "duration": "8s",
  "generate_audio": false
}
```

> 注意: duration 格式为 `"8s"` (带 s 后缀)

### 2.3 Sora 2 I2V (`fal::fal-sora2`)

**endpoint:** `fal-ai/sora-2/image-to-video`

```json
{
  "image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9",
  "duration": 4,
  "delete_video": false
}
```

> 注意: Sora 2 不支持 negative_prompt

### 2.4 Kling 2.5 Turbo Pro I2V (`fal::fal-ai/kling-video/v2.5-turbo/pro/image-to-video`)

**endpoint:** `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`

```json
{
  "image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "duration": "5",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

> 硬编码了 negative_prompt 和 cfg_scale

### 2.5 Kling 3 Standard I2V (`fal::fal-ai/kling-video/v3/standard/image-to-video`)

**endpoint:** `fal-ai/kling-video/v3/standard/image-to-video`

```json
{
  "start_image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9",
  "duration": "5",
  "generate_audio": false
}
```

> 注意: 图片参数名为 `start_image_url`（非 `image_url`）

### 2.6 Kling 3 Pro I2V (`fal::fal-ai/kling-video/v3/pro/image-to-video`)

**endpoint:** `fal-ai/kling-video/v3/pro/image-to-video`

```json
{
  "start_image_url": "<base64_image>",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9",
  "duration": "5",
  "generate_audio": false
}
```

> 与 Kling 3 Standard 结构一致，输出质量更高

---

## 3. ARK 模型 (火山引擎 Seedance)

ARK 使用 `content` 数组传递 prompt 和图片，图片以 `image_url.url` 格式嵌入。支持首尾帧模式（通过 `role: 'first_frame'` / `role: 'last_frame'`）。

### 3.1 Seedance 1.0 Pro (`ark::doubao-seedance-1-0-pro-250528`)

**endpoint:** `ark/video_generation`

```json
{
  "model": "doubao-seedance-1-0-pro-250528",
  "content": [
    {
      "type": "text",
      "text": "少年睁大双眼躺在床上，直直望着屋顶"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "<base64_image>"
      }
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5
}
```

### 3.2 Seedance 1.0 Pro Fast (`ark::doubao-seedance-1-0-pro-fast-251015`)

**endpoint:** `ark/video_generation`

```json
{
  "model": "doubao-seedance-1-0-pro-fast-251015",
  "content": [
    {
      "type": "text",
      "text": "少年睁大双眼躺在床上，直直望着屋顶"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "<base64_image>"
      }
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5
}
```

### 3.3 Seedance 1.0 Lite I2V (`ark::doubao-seedance-1-0-lite-i2v-250428`)

**endpoint:** `ark/video_generation`

```json
{
  "model": "doubao-seedance-1-0-lite-i2v-250428",
  "content": [
    {
      "type": "text",
      "text": "少年睁大双眼躺在床上，直直望着屋顶"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "<base64_image>"
      }
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5
}
```

### 3.4 Seedance 1.5 Pro (`ark::doubao-seedance-1-5-pro-251215`)

**endpoint:** `ark/video_generation`

```json
{
  "model": "doubao-seedance-1-5-pro-251215",
  "content": [
    {
      "type": "text",
      "text": "少年睁大双眼躺在床上，直直望着屋顶"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "<base64_image>"
      }
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5
}
```

> Seedance 1.5 Pro 额外支持 `generate_audio: true` 和 `draft: true` 参数

---

## 4. MiniMax 模型 (海螺)

MiniMax 使用 `first_frame_image` 参数名传递首帧图片，resolution 使用大写格式（如 `1080P`）。支持首尾帧模式（额外传 `last_frame_image`）。

### 4.1 Hailuo 2.3 (`minimax::minimax-hailuo-2.3`)

**endpoint:** `minimax/video_generation`

```json
{
  "model": "MiniMax-Hailuo-2.3",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "prompt_optimizer": true,
  "duration": 6,
  "resolution": "1080P",
  "first_frame_image": "<base64_image>"
}
```

> 1080P 最大 6 秒；10 秒仅限 768P

### 4.2 Hailuo 02 (`minimax::minimax-hailuo-02`)

**endpoint:** `minimax/video_generation`

```json
{
  "model": "MiniMax-Hailuo-02",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "prompt_optimizer": true,
  "duration": 6,
  "resolution": "768P",
  "first_frame_image": "<base64_image>"
}
```

> Hailuo 02 支持首尾帧模式（额外传 `last_frame_image`）

---

## 5. Vidu 模型

Vidu 使用 `images` 数组传递图片（首帧 + 可选末帧），duration 和 resolution 为必传字段。

### 5.1 Vidu Q3 Pro (`vidu::viduq3-pro`)

**endpoint:** `vidu/img2video`

```json
{
  "model": "viduq3-pro",
  "images": [
    "<base64_image>"
  ],
  "duration": 5,
  "resolution": "720p",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9"
}
```

> Q3 Pro 支持 1-16 秒时长、音频生成、首尾帧模式

### 5.2 Vidu Q2 Pro (`vidu::viduq2-pro`)

**endpoint:** `vidu/img2video`

```json
{
  "model": "viduq2-pro",
  "images": [
    "<base64_image>"
  ],
  "duration": 5,
  "resolution": "720p",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9"
}
```

### 5.3 Vidu Q2 Turbo (`vidu::viduq2-turbo`)

**endpoint:** `vidu/img2video`

```json
{
  "model": "viduq2-turbo",
  "images": [
    "<base64_image>"
  ],
  "duration": 5,
  "resolution": "720p",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "aspect_ratio": "16:9"
}
```

---

## 6. Google Veo 模型 (直连)

Google Veo 使用 SDK 调用，图片以 `{ mimeType, imageBytes }` 内联格式传递，配置项放在 `config` 对象中。

### 6.1 Veo 3.1 (`google::veo-3.1-generate-preview`)

**endpoint:** `google/veo-3.1-generate-preview`

```json
{
  "model": "veo-3.1-generate-preview",
  "image": {
    "mimeType": "image/jpeg",
    "imageBytes": "<base64>"
  },
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "config": {
    "aspectRatio": "16:9",
    "resolution": "720p",
    "durationSeconds": 8
  }
}
```

> 支持 `config.lastFrame` 用于首尾帧模式

### 6.2 Veo 3.0 (`google::veo-3.0-generate-001`)

**endpoint:** `google/veo-3.0-generate-001`

```json
{
  "model": "veo-3.0-generate-001",
  "image": {
    "mimeType": "image/jpeg",
    "imageBytes": "<base64>"
  },
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "config": {
    "aspectRatio": "16:9",
    "durationSeconds": 8
  }
}
```

---

## 7. OpenAI-Compatible 模型 (Sora)

OpenAI-Compatible 使用 SDK 调用 `/v1/videos`，图片作为 File 对象通过 `input_reference` 传递。尺寸使用像素格式而非比例。

### 7.1 Sora 2 (`openai::sora-2`)

**endpoint:** `openai/v1/videos`

```json
{
  "model": "sora-2",
  "prompt": "少年睁大双眼躺在床上，直直望着屋顶",
  "input_reference": "<image_file>",
  "seconds": "4",
  "size": "1280x720"
}
```

> - `seconds` 为字符串格式: `"4"` / `"8"` / `"12"`
> - `size` 由 aspectRatio + resolution 推算: 16:9 -> `1280x720`, 9:16 -> `720x1280`
> - SDK 失败时自动 fallback 到 `/v1/video/create` 端点（使用 `image_url` 替代 `input_reference`）

---

## 附录 A: 跨模型关键差异汇总

| 维度 | Replicate | FAL | ARK | MiniMax | Vidu | Google | OpenAI |
|------|-----------|-----|-----|---------|------|--------|--------|
| **首帧参数** | `image` / `start_image` / `first_frame_image` | `image_url` / `start_image_url` | `content[].image_url.url` | `first_frame_image` | `images[0]` | `image.imageBytes` | `input_reference` (File) |
| **图片格式** | Base64 Data URL | Base64 Data URL | Base64 Data URL | Base64 Data URL | Base64 Data URL | 裸 Base64 | File 对象 |
| **duration 类型** | number | string / string+s / number | number | number | number | number (config) | string |
| **比例参数** | `aspect_ratio` | `aspect_ratio` | `ratio` | (无) | `aspect_ratio` | `config.aspectRatio` | `size` (像素) |
| **分辨率参数** | (无) | `resolution` | `resolution` | `resolution` (大写) | `resolution` | `config.resolution` | `size` (像素) |
| **负向提示词** | (无) | Kling 系列硬编码 | (无) | (无) | (无) | (无) | (无) |

## 附录 B: 首尾帧支持情况

| 提供商 | 模型 | 首帧参数 | 尾帧参数 | 支持首尾帧 |
|--------|------|---------|---------|-----------|
| Replicate | Kling v2.5 | `start_image` | `end_image` | Yes |
| Replicate | Kling v2.6 | `start_image` | - | No |
| Replicate | Veo 3.1 | `image` | `last_frame` | Yes |
| Replicate | Veo 3 | `image` | - | No |
| Replicate | Wan 2.6 | `image` | - | No |
| Replicate | Hailuo 2.3 | `first_frame_image` | - | No (Replicate 版) |
| Replicate | Ray 2 | `start_image` | `end_image` | Yes |
| Replicate | Gen4 | `image` | - | No |
| FAL | Kling 3 Std/Pro | `start_image_url` | - | No (FAL 版) |
| FAL | 其他 | `image_url` | - | No |
| ARK | Seedance 全系 | `content[].role: first_frame` | `content[].role: last_frame` | Yes |
| MiniMax | Hailuo 全系 | `first_frame_image` | `last_frame_image` | Yes |
| Vidu | 全系 | `images[0]` | `images[1]` | Yes |
| Google | Veo 3.1 | `image` | `config.lastFrame` | Yes |
| Google | Veo 3.0/2.0 | `image` | - | No |
| OpenAI | Sora 2 | `input_reference` | - | No |

---

*文档更新时间: 2026-03-07*
*源码: `src/lib/video-prompt-engine/request-preview.ts`*
*Generator 源码: `src/lib/generators/replicate.ts`, `fal.ts`, `ark.ts`, `minimax.ts`, `vidu.ts`, `video/google.ts`, `video/openai-compatible.ts`*
