# PRD: 视频生成提示词工程优化

**版本**: v1.0
**日期**: 2026-03-06
**状态**: 草案

---

## 1. 背景与问题

### 1.1 当前问题

用户在视频生成环节发现 **分镜图片与生成视频差距过大**。经代码审计，根因如下：

| 问题 | 详情 |
|------|------|
| **prompt 信息量不足** | 当前仅传 `panel.videoPrompt`（如"少年睁大双眼躺在床上…"），缺少画风、场景氛围、角色外观等约束 |
| **丰富数据未利用** | 面板已有 `shotType`、`cameraMove`、`location`、`characters`、`photographyRules`、`actingNotes` 等字段，均未传入视频 API |
| **项目级风格丢失** | `artStyle`、`artStylePrompt`、`globalAssetText` 等项目配置未注入视频 prompt |
| **模型默认参数缺失** | 大量模型支持 `negative_prompt`、`cfg_scale`、`duration` 等参数，当前均未设置默认值 |
| **请求体不可预览** | 用户无法在生成前查看将发送给模型的实际 prompt 和参数 |

### 1.2 当前数据流

```
panel.videoPrompt ──> worker ──> generator ──> 外部API
      │                                          │
      └── 仅传 prompt + image_url ───────────────┘
          （丢失场景/角色/画风/镜头等信息）
```

### 1.3 目标数据流

```
panel 元数据 ─┐
角色外观描述 ──┤
场景/光影描述 ─┤──> 提示词引擎 ──> 完整 prompt ──┐
摄影规则 ──────┤                                  ├──> 请求体预览 ──> 外部API
项目画风 ──────┘                                  │
模型默认参数 ─────────────────────────────────────┘
```

---

## 2. 目标

1. **每个视频模型定义默认请求体**，包含该模型推荐的 `negative_prompt`、`duration`、`cfg_scale` 等参数
2. **在视频生成面板中预览默认请求体**，用户可查看将要发送的完整参数
3. **当面板存在镜头/画风/角色/场景信息时，自动拼接到 prompt**，覆盖默认内容
4. **预览框实时反映拼接后的完整 prompt 和请求参数**，用户可在生成前确认

---

## 3. 各视频模型官方参数规格

### 3.1 Replicate 模型

> **重要发现**: 各 Replicate 模型的图片参数名**各不相同**，当前代码统一使用 `image_url` 可能导致部分模型无法正确接收图片。需按模型适配。

#### 3.1.1 Kling v2.6 (`kwaivgi/kling-v2.6`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`start_image`** | string (URI) | — | 否* | 首帧图片（I2V模式必填）。提供后 aspect_ratio 被忽略 |
| `negative_prompt` | string | — | 否 | 排除内容 |
| `aspect_ratio` | string | — | 否 | 16:9 / 9:16 / 1:1（有 start_image 时忽略） |
| `duration` | integer | — | 否 | 5 或 10 秒 |
| `generate_audio` | boolean | — | 否 | 生成同步音频 |

**Prompt 技巧**: 对话放引号内，指定声音特征（如"温柔女声"），明确描述环境音。中英文音频效果最佳。

#### 3.1.2 Kling v2.5 Turbo Pro (`kwaivgi/kling-v2.5-turbo-pro`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`start_image`** | string (URI) | — | 否* | 首帧图片 |
| `end_image` | string (URI) | — | 否 | 末帧图片（过渡生成） |
| `negative_prompt` | string | — | 否 | 排除内容 |
| `aspect_ratio` | string | "16:9" | 否 | 有 start_image 时忽略 |
| `duration` | integer | 5 | 否 | 时长（秒） |
| **`guidance_scale`** | float | 0.5 | 否 | 提示词遵循强度（注意：非 cfg_scale） |

#### 3.1.3 Veo 3.1 (`google/veo-3.1`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`image`** | string (URI) | — | 否* | 首帧图片。推荐 1280x720 或 720x1280 |
| `last_frame` | string (URI) | — | 否 | 末帧图片（帧插值模式） |
| `reference_images` | string[] | — | 否 | 1-3 张参考图（角色/风格一致性）。仅 16:9 + 8s 可用 |
| `negative_prompt` | string | — | 否 | 排除内容 |
| `aspect_ratio` | string | — | 否 | 16:9 / 9:16 |
| `duration` | integer | — | 否 | 4 / 6 / 8 秒 |
| `resolution` | string | — | 否 | 720p / 1080p (24fps) |
| `generate_audio` | boolean | false | 否 | 生成音频 |
| `seed` | integer | — | 否 | 随机种子 |

**特殊能力**: `reference_images` 可传 1-3 张参考图实现角色/风格一致性（仅限 16:9 + 8s）。

#### 3.1.4 Veo 3 (`google/veo-3`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`image`** | string (URI) | — | 否* | 首帧图片。推荐 16:9 或 9:16，1280x720 |
| `negative_prompt` | string | — | 否 | 排除内容 |
| `aspect_ratio` | string | — | 否 | 宽高比 |
| `duration` | integer | — | 否 | 时长（秒） |
| `resolution` | string | — | 否 | 分辨率 |
| `generate_audio` | boolean | — | 否 | 生成音频 |
| `seed` | integer | — | 否 | 随机种子 |

#### 3.1.5 Wan 2.6 I2V (`wan-video/wan-2.6-i2v`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| **`image`** | string (URI) | — | **是** | 首帧图片（I2V 模型，图片必填） |
| `prompt` | string | — | **是** | 视频描述 |
| `negative_prompt` | string | — | 否 | 排除内容 |
| `audio` | string (URI) | — | 否 | 音频文件（WAV/MP3，3-30s，口型同步） |
| `resolution` | string | — | 否 | 480p-1080p |
| `duration` | integer | — | 否 | 5-15 秒 |
| `enable_prompt_expansion` | boolean | — | 否 | LLM 自动扩写 prompt |
| `multi_shots` | boolean | — | 否 | 多镜头分割（需启用 prompt_expansion） |
| `seed` | integer | — | 否 | 随机种子 |

**特殊能力**: 原生口型同步，可传 `audio` 参数驱动口型动画。

#### 3.1.6 Hailuo 2.3 (`minimax/hailuo-2.3`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`first_frame_image`** | string (URI) | — | 否* | 首帧图片。输出宽高比跟随图片 |
| `duration` | integer | — | 否 | 6 或 10 秒。10s 仅支持 768p |
| `resolution` | string | — | 否 | 768p / 1080p。1080p 仅支持 6s |
| `prompt_optimizer` | boolean | — | 否 | 优化文本描述 |

**约束**: 1080p 最大 6 秒；10 秒仅限 768p。

#### 3.1.7 Ray 2 720p (`luma/ray-2-720p`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | 是 | 视频描述 |
| **`start_image`** | string (URI) | — | 否* | 首帧图片 |
| `end_image` | string (URI) | — | 否 | 末帧图片 |
| `duration` | integer | 5 | 否 | 5 或 9 秒 |
| `aspect_ratio` | string | "16:9" | 否 | 宽高比 |
| `loop` | boolean | false | 否 | 循环播放（首末帧匹配） |
| **`concepts`** | string[] | — | 否 | 镜头运动概念列表（34 种） |

**特殊能力 - 镜头概念（34种）**:
`truck_left`, `pan_right`, `pedestal_down`, `low_angle`, `pedestal_up`, `selfie`, `pan_left`, `roll_right`, `zoom_in`, `over_the_shoulder`, `orbit_right`, `orbit_left`, `static`, `tiny_planet`, `high_angle`, `bolt_cam`, `dolly_zoom`, `overhead`, `zoom_out`, `handheld`, `roll_left`, `pov`, `aerial_drone`, `push_in`, `crane_down`, `truck_right`, `tilt_down`, `elevator_doors`, `tilt_up`, `ground_level`, `pull_out`, `aerial`, `crane_up`, `eye_level`

#### 3.1.8 Gen4 Turbo (`runwayml/gen4-turbo`)

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `prompt` | string | — | **是** | 视频描述 |
| **`image`** | string (URI) | — | **是** | 首帧图片（必填） |
| `aspect_ratio` | string | — | 否 | 宽高比 |
| `duration` | integer | — | 否 | 5 或 10 秒 |
| `seed` | integer | — | 否 | 随机种子 |

### 3.1.9 Replicate 模型图片参数名对照表

> 当前代码统一使用 `image_url`，但官方 API 各不相同。**这是一个需要修复的 Bug。**

| 模型 | 官方图片参数名 | 当前代码使用 | 状态 |
|------|---------------|-------------|------|
| Kling v2.6 | `start_image` | `image_url` | **不一致** |
| Kling v2.5 | `start_image` | `image_url` | **不一致** |
| Veo 3.1 | `image` | `image_url` | **不一致** |
| Veo 3 | `image` | `image_url` | **不一致** |
| Wan 2.6 I2V | `image` | `image_url` | **不一致** |
| Hailuo 2.3 | `first_frame_image` | `image_url` | **不一致** |
| Ray 2 | `start_image` | `image_url` | **不一致** |
| Gen4 Turbo | `image` | `image_url` | **不一致** |

> **注**: 当前经 UniAPI 代理网关可能做了参数名映射，因此视频仍能生成。但直连 Replicate 时将失败。此问题应在 Phase 1 中修复。

### 3.2 FAL 模型

#### 3.2.1 Wan v2.6 I2V (`fal-ai/wan/v2.6/image-to-video`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_url` | string | — | **必填** 首帧图片（240-7680px） |
| `prompt` | string | — | **必填** 视频描述（最大 800 字符） |
| `resolution` | enum | "1080p" | 720p / 1080p |
| `duration` | enum | 5 | 5 / 10 / 15 秒 |
| `negative_prompt` | string | "" | 排除内容（最大 500 字符） |
| `enable_prompt_expansion` | boolean | true | LLM 自动扩写 |
| `multi_shots` | boolean | false | 多镜头模式 |
| `seed` | integer | — | 随机种子 |

#### 3.2.2 Veo 3.1 Fast I2V (`fal-ai/veo3.1/fast/image-to-video`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_url` | string | — | **必填** 首帧图片 |
| `prompt` | string | — | **必填** 视频描述 |
| `aspect_ratio` | enum | "auto" | auto / 16:9 / 9:16 |
| `duration` | enum | "8s" | "4s" / "6s" / "8s" |
| `resolution` | enum | "720p" | 720p / 1080p / 4k |
| `negative_prompt` | string | — | 排除内容 |
| `generate_audio` | boolean | true | 生成音频 |

#### 3.2.3 Sora 2 I2V (`fal-ai/sora-2/image-to-video`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_url` | string | — | **必填** 首帧图片 |
| `prompt` | string | — | **必填**（最大 5000 字符） |
| `resolution` | enum | "auto" | auto / 720p |
| `aspect_ratio` | enum | "auto" | auto / 9:16 / 16:9 |
| `duration` | integer | 4 | 4 / 8 / 12 秒 |
| `delete_video` | boolean | true | 生成后是否删除（隐私） |

**注意**: Sora 2 **不支持** negative_prompt。

#### 3.2.4 Kling 2.5 Turbo Pro I2V (`fal-ai/kling-video/v2.5-turbo/pro/image-to-video`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `image_url` | string | — | **必填** 首帧图片 |
| `prompt` | string | — | **必填** 视频描述 |
| `duration` | enum | "5" | "5" / "10" 秒 |
| `negative_prompt` | string | "blur, distort, and low quality" | 排除内容 |
| `cfg_scale` | float | 0.5 | 提示词遵循强度 |
| `tail_image_url` | string | — | 末帧图片（可选） |

#### 3.2.5 Kling 3 Standard I2V (`fal-ai/kling-video/v3/standard/image-to-video`)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `start_image_url` | string | — | **必填** 首帧图片 |
| `prompt` | string | — | 视频描述（与 multi_prompt 二选一） |
| `multi_prompt` | list | — | 多镜头 prompt 列表 |
| `duration` | enum | "5" | 3-15 秒 |
| `aspect_ratio` | enum | "16:9" | 16:9 / 9:16 / 1:1 |
| `negative_prompt` | string | "blur, distort, and low quality" | 排除内容 |
| `cfg_scale` | float | 0.5 | 提示词遵循强度 |
| `generate_audio` | boolean | true | 生成音频 |
| `end_image_url` | string | — | 末帧图片 |
| `elements` | list | — | 角色/物体绑定 |

#### 3.2.6 Kling 3 Pro I2V (`fal-ai/kling-video/v3/pro/image-to-video`)

与 Kling 3 Standard 参数完全一致，输出质量更高。

---

## 4. 各模型推荐默认请求体

根据官方文档和最佳实践，为每个模型定义推荐的默认参数配置。

### 4.1 默认参数配置表

```typescript
const VIDEO_MODEL_DEFAULTS: Record<string, VideoModelDefaults> = {

  // ===== Replicate 模型 =====
  // 注意：imageParamName 表示该模型的图片参数名，需在 Generator 中按模型适配

  'replicate::replicate-kling26': {
    imageParamName: 'start_image',         // 官方参数名
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    duration: 5,
    // aspect_ratio 由 start_image 自动推断，无需传
  },

  'replicate::replicate-kling25': {
    imageParamName: 'start_image',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    guidance_scale: 0.5,                   // 注意：非 cfg_scale
    duration: 5,
  },

  'replicate::replicate-veo31': {
    imageParamName: 'image',
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
    enable_prompt_expansion: false,        // 关闭以确保 prompt 一致性
  },

  'replicate::replicate-hailuo': {
    imageParamName: 'first_frame_image',
    duration: 6,
    resolution: '1080p',                   // 1080p 仅支持 6s
  },

  'replicate::replicate-ray2': {
    imageParamName: 'start_image',
    duration: 5,
    aspect_ratio: '${projectVideoRatio}',
    // concepts 由面板 cameraMove 映射（见 5.5 节）
  },

  'replicate::replicate-gen4': {
    imageParamName: 'image',
    duration: 10,
  },

  // ===== FAL 模型 =====

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
    aspect_ratio: '${projectVideoRatio}',
    generate_audio: false,
    resolution: '1080p',
  },

  'fal::fal-sora2': {
    imageParamName: 'image_url',
    duration: 4,
    aspect_ratio: '${projectVideoRatio}',
    delete_video: false,
    // 注意：Sora 2 不支持 negative_prompt
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
    aspect_ratio: '${projectVideoRatio}',
    generate_audio: false,
  },

  'fal::fal-ai/kling-video/v3/pro/image-to-video': {
    imageParamName: 'start_image_url',
    negative_prompt: 'blur, distort, low quality, deformation, disfigured',
    cfg_scale: 0.5,
    duration: '5',
    aspect_ratio: '${projectVideoRatio}',
    generate_audio: false,
  },
}
```

### 4.2 默认请求体预览示例

以 `replicate::replicate-kling26` 为例，面板无额外信息时的默认请求体：

```json
{
  "input": {
    "start_image": "data:image/jpeg;base64,...",
    "prompt": "少年睁大双眼躺在床上，直直望着屋顶，手指轻轻抓着旧棉被，镜头缓缓推近他的面部",
    "negative_prompt": "blur, distort, low quality, deformation, disfigured",
    "duration": 5
  }
}
```

以 `replicate::replicate-ray2` 为例（利用镜头概念）：

```json
{
  "input": {
    "start_image": "data:image/jpeg;base64,...",
    "prompt": "A young boy lies in bed staring at the ceiling...",
    "duration": 5,
    "aspect_ratio": "9:16",
    "concepts": ["push_in"]
  }
}
```

---

## 5. 提示词拼接策略

### 5.1 面板可用数据源

| 数据源 | 字段 | 类型 | 示例 |
|--------|------|------|------|
| **视频提示词** | `panel.videoPrompt` | string | "少年睁大双眼躺在床上…" |
| **场景描述** | `panel.description` | string | "中景：韩立睁大双眼躺在床上…" |
| **镜头类型** | `panel.shotType` | string | "平视中景" |
| **镜头运动** | `panel.cameraMove` | string | "缓缓推近" |
| **场景位置** | `panel.location` | string | "茅草屋_夜晚" |
| **角色列表** | `panel.characters` | JSON | `[{"name":"韩立","appearance":"初始形象"}]` |
| **摄影规则** | `panel.photographyRules` | JSON | `{composition, lighting, color_palette, atmosphere}` |
| **演技指导** | `panel.actingNotes` | JSON | `{character_actions, expressions}` |
| **项目画风** | `project.artStylePrompt` | string | "American comic style, bold lines…" |
| **全局上下文** | `project.globalAssetText` | string | 全局角色/场景说明 |
| **角色外观** | `appearance.descriptions[selectedIndex]` | string | "黑发少年，瘦弱身材，穿灰色粗布衣…" |

### 5.2 提示词拼接模板

当面板包含丰富信息时，按以下结构拼接完整 prompt：

```
[画风层]  {project.artStylePrompt}
[场景层]  {panel.location} 场景，{photographyRules.atmosphere}
[角色层]  角色：{角色名} - {角色外观描述}
[动作层]  {panel.videoPrompt 或 panel.description}
[镜头层]  {panel.shotType}，镜头{panel.cameraMove}
[摄影层]  {photographyRules.lighting}，{photographyRules.color_palette}
```

### 5.3 拼接示例

**拼接前（当前行为）**：
```
少年睁大双眼躺在床上，直直望着屋顶，手指轻轻抓着旧棉被，镜头缓缓推近他的面部
```

**拼接后（优化后）**：
```
American comic style, bold ink outlines, dramatic shadows.
茅草屋夜晚场景，昏暗烛光，氛围压抑沉寂.
角色：韩立 - 十岁左右的瘦弱少年，黑发，穿灰色粗布短衫，面色蜡黄.
少年睁大双眼躺在床上，直直望着屋顶，手指轻轻抓着旧棉被.
平视中景，镜头缓缓推近面部.
侧光照明，暖黄与冷灰色调对比.
```

### 5.4 Ray 2 镜头概念自动映射

当使用 `luma/ray-2-720p` 模型时，可将面板 `cameraMove` 字段自动映射为 Ray 2 `concepts` 参数：

| panel.cameraMove | Ray 2 concepts |
|-----------------|----------------|
| 推近 / 推进 | `push_in` |
| 拉远 / 拉出 | `pull_out` |
| 左摇 | `pan_left` |
| 右摇 | `pan_right` |
| 上摇 | `tilt_up` |
| 下摇 | `tilt_down` |
| 左移 | `truck_left` |
| 右移 | `truck_right` |
| 升起 / 上升 | `crane_up` |
| 下降 | `crane_down` |
| 环绕左 | `orbit_left` |
| 环绕右 | `orbit_right` |
| 变焦推进 | `zoom_in` |
| 变焦拉远 | `zoom_out` |
| 固定 / 静止 | `static` |
| 手持 | `handheld` |
| 航拍 / 俯拍 | `aerial_drone` |
| 俯视 | `overhead` |
| 仰视 / 低角度 | `low_angle` |
| 高角度 | `high_angle` |
| 平视 | `eye_level` |
| 主观视角 / POV | `pov` |

### 5.5 拼接优先级与覆盖规则

```
用户手动编辑 prompt  >  自动拼接 prompt  >  panel.videoPrompt  >  panel.description
```

| 场景 | 行为 |
|------|------|
| 用户在预览框手动修改了 prompt | 使用用户修改后的版本，不再自动拼接 |
| 面板有完整元数据（镜头+场景+角色） | 自动拼接完整 prompt，覆盖默认 videoPrompt |
| 面板只有 videoPrompt | 使用 videoPrompt + 模型默认参数 |
| 面板仅有 description | 使用 description + 模型默认参数 |

---

## 6. UI 设计：请求体预览面板

### 6.1 预览面板位置

在现有 `VideoPanelCardBody` 组件中，位于 **prompt 编辑区下方、生成按钮上方**，新增可折叠的"请求预览"区域。

### 6.2 预览面板布局

```
┌─────────────────────────────────────────────┐
│  [面板 1]  平视中景 | 5.0s                   │
│  ┌─────────────────────────────────────────┐ │
│  │ 🖼️ 分镜图片                              │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  📝 视频提示词                    [✏️ 编辑]   │
│  ┌─────────────────────────────────────────┐ │
│  │ 少年睁大双眼躺在床上…                     │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  📋 请求预览                   [▼ 展开/收起]  │  ← 新增
│  ┌─────────────────────────────────────────┐ │
│  │ ┌─ Prompt (拼接后) ──────────────────┐  │ │
│  │ │ American comic style...             │  │ │
│  │ │ 茅草屋夜晚场景...                    │  │ │
│  │ │ 角色：韩立 - 瘦弱少年...             │  │ │
│  │ │ 少年睁大双眼躺在床上...              │  │ │
│  │ │ 平视中景，镜头缓缓推近...            │  │ │
│  │ └────────────────────── [📋复制] [✏️] │  │ │
│  │                                        │ │
│  │ ┌─ 参数 ─────────────────────────────┐│ │
│  │ │ negative_prompt: blur, distort...   ││ │
│  │ │ cfg_scale: 0.5                      ││ │
│  │ │ duration: 5                         ││ │
│  │ │ aspect_ratio: 9:16                  ││ │
│  │ └────────────────────────────────────┘│ │
│  │                                        │ │
│  │ 数据来源标签：                          │ │
│  │ [画风✓] [场景✓] [角色✓] [镜头✓] [摄影○] │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [模型选择 ▼]  [⚡ 生成视频]                  │
│                                               │
└─────────────────────────────────────────────┘
```

### 6.3 数据来源标签说明

预览面板底部显示数据来源标签，用颜色区分：

| 标签 | 含义 | 状态 |
|------|------|------|
| `画风 ✓` | 项目 artStylePrompt 已注入 | 绿色 = 已注入 |
| `场景 ✓` | panel.location 已注入 | 绿色 = 已注入 |
| `角色 ✓` | 角色外观描述已注入 | 绿色 = 已注入 |
| `镜头 ✓` | shotType + cameraMove 已注入 | 绿色 = 已注入 |
| `摄影 ○` | photographyRules 未设置 | 灰色 = 无数据 |
| `演技 ○` | actingNotes 未设置 | 灰色 = 无数据 |

### 6.4 交互行为

| 操作 | 行为 |
|------|------|
| 切换模型 | 预览面板实时更新默认参数（不同模型参数不同） |
| 展开/收起 | 折叠状态仅显示一行摘要："Kling v2.6 | prompt: 128字 | 5参数" |
| 编辑 prompt | 点击编辑图标进入编辑模式，修改后标记为"用户自定义"，不再自动拼接 |
| 复制 | 一键复制完整请求体 JSON |
| 重置 | 取消用户修改，恢复自动拼接模式 |
| 鼠标悬停标签 | Tooltip 显示该层注入的具体内容 |

---

## 7. 技术方案

### 7.1 新增模块

#### 7.1.1 `src/lib/video-prompt-engine/defaults.ts`

模型默认参数配置表（第 4.1 节的内容）。

```typescript
export interface VideoModelDefaults {
  negative_prompt?: string
  cfg_scale?: number
  duration?: number | string
  aspect_ratio?: string
  resolution?: string
  generate_audio?: boolean
  enable_prompt_expansion?: boolean
  delete_video?: boolean
  [key: string]: unknown
}

export function getVideoModelDefaults(modelKey: string): VideoModelDefaults
```

#### 7.1.2 `src/lib/video-prompt-engine/enricher.ts`

提示词拼接引擎，根据面板元数据和项目配置生成完整 prompt。

```typescript
export interface PromptEnrichmentContext {
  panel: {
    videoPrompt?: string
    description?: string
    shotType?: string
    cameraMove?: string
    location?: string
    characters?: string  // JSON string
    photographyRules?: string  // JSON string
    actingNotes?: string  // JSON string
  }
  project: {
    artStylePrompt?: string
    globalAssetText?: string
    videoRatio?: string
  }
  characterAppearances?: Map<string, string>  // name → appearance description
  userOverride?: string  // 用户手动修改的 prompt
}

export interface EnrichedPromptResult {
  prompt: string           // 最终 prompt
  sources: PromptSource[]  // 数据来源标记
  isUserOverride: boolean  // 是否为用户手动覆盖
}

export type PromptSourceType = 'artStyle' | 'scene' | 'character' | 'camera' | 'photography' | 'acting'

export interface PromptSource {
  type: PromptSourceType
  active: boolean      // 是否有数据并已注入
  content: string      // 注入的具体内容
}

export function enrichVideoPrompt(context: PromptEnrichmentContext): EnrichedPromptResult
```

#### 7.1.3 `src/lib/video-prompt-engine/request-builder.ts`

根据模型 key + 拼接后的 prompt + 默认参数 → 构建完整请求体预览。

```typescript
export interface VideoRequestPreview {
  modelKey: string
  modelName: string
  prompt: string
  parameters: Record<string, unknown>  // 模型参数（不含 image_url）
  sources: PromptSource[]
}

export function buildVideoRequestPreview(
  modelKey: string,
  enrichedPrompt: EnrichedPromptResult,
  projectVideoRatio?: string,
  userGenerationOptions?: Record<string, unknown>,
): VideoRequestPreview
```

### 7.2 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/lib/workers/video.worker.ts` | `generateVideoForPanel()` 调用 `enrichVideoPrompt()` 替代直接使用 `panel.videoPrompt` |
| `src/lib/generators/replicate.ts` | `doGenerate()` 接收并传递 `negative_prompt`、`cfg_scale` 等新参数 |
| `src/lib/generators/fal.ts` | 各模型分支补充缺失的默认参数 |
| `src/app/.../video/panel-card/VideoPanelCardBody.tsx` | 新增请求预览面板 UI |
| `src/app/.../video/panel-card/runtime/videoPanelRuntimeCore.tsx` | 接入 prompt 引擎，传递预览数据 |
| `src/app/.../video/panel-card/types.ts` | 扩展 props 类型 |

### 7.3 数据流变更

```
                  ┌──────────────────────────────┐
                  │  video-prompt-engine          │
                  │                              │
 panel 元数据 ───>│  enricher.ts                 │──> enrichedPrompt
 project 配置 ───>│  (拼接 prompt)               │        │
 角色外观 ───────>│                              │        │
                  │  defaults.ts                 │        v
                  │  (模型默认参数)               │  request-builder.ts
                  │                              │  (构建预览)
                  │  request-builder.ts           │        │
                  │  (预览 + 实际请求)            │        v
                  └──────────────────────────────┘   VideoRequestPreview
                                                          │
                          ┌───────────────────────────────┤
                          │                               │
                          v                               v
                   前端预览面板                    worker 实际调用
                   (用户确认)                     (同一份参数)
```

### 7.4 Worker 侧改动

`video.worker.ts` 中的 `generateVideoForPanel()` 改为：

```typescript
// 之前
const prompt = customPrompt || panel.videoPrompt || panel.description

// 之后
const enriched = enrichVideoPrompt({
  panel: {
    videoPrompt: panel.videoPrompt,
    description: panel.description,
    shotType: panel.shotType,
    cameraMove: panel.cameraMove,
    location: panel.location,
    characters: panel.characters,
    photographyRules: panel.photographyRules,
    actingNotes: panel.actingNotes,
  },
  project: {
    artStylePrompt: projectConfig.artStylePrompt,
    globalAssetText: projectConfig.globalAssetText,
    videoRatio: projectModels.videoRatio,
  },
  characterAppearances: await resolveCharacterAppearances(panel),
  userOverride: customPrompt || undefined,
})
const prompt = enriched.prompt
```

### 7.5 Generator 侧改动

#### 7.5.1 图片参数名适配（关键 Bug 修复）

`replicate.ts` 需要根据模型使用正确的图片参数名：

```typescript
// 之前（所有模型统一用 image_url）
const input: Record<string, unknown> = {
    image_url: imageUrl,
}

// 之后（按模型适配）
const defaults = getVideoModelDefaults(modelKey)
const imageParamName = defaults.imageParamName || 'image_url'
const input: Record<string, unknown> = {
    [imageParamName]: imageUrl,  // 使用正确的参数名
}
```

**各模型图片参数名映射**：

```typescript
const REPLICATE_IMAGE_PARAM_NAMES: Record<string, string> = {
    'replicate-kling26':  'start_image',
    'replicate-kling25':  'start_image',
    'replicate-veo31':    'image',
    'replicate-veo3':     'image',
    'replicate-wan26':    'image',
    'replicate-hailuo':   'first_frame_image',
    'replicate-ray2':     'start_image',
    'replicate-gen4':     'image',
}
```

#### 7.5.2 完整参数注入

```typescript
// 之前
if (prompt) input.prompt = prompt
if (typeof duration === 'number') input.duration = duration
if (aspectRatio) input.aspect_ratio = aspectRatio

// 之后
const defaults = getVideoModelDefaults(modelKey)
const { imageParamName, ...modelDefaults } = defaults

// 注入模型默认参数
Object.assign(input, modelDefaults)
// 用户选项覆盖默认值
Object.assign(input, userGenerationOptions)
// prompt 和图片始终使用实际值
if (prompt) input.prompt = prompt
input[imageParamName] = imageUrl
```

#### 7.5.3 Ray 2 镜头概念映射

```typescript
// 当模型为 ray2 且面板有 cameraMove 时
if (modelId === 'replicate-ray2' && options.cameraMove) {
    const concepts = mapCameraMoveToConcepts(options.cameraMove)
    if (concepts.length > 0) input.concepts = concepts
}
```

---

## 8. 实施阶段

### Phase 1：图片参数名修复 + 模型默认参数 + Generator 改造

- **[Bug 修复]** `replicate.ts` 按模型使用正确的图片参数名（`start_image` / `image` / `first_frame_image`）
- **[Bug 修复]** Kling v2.5 参数名：`guidance_scale`（非 `cfg_scale`）
- 创建 `video-prompt-engine/defaults.ts`
- 修改 `replicate.ts` 和 `fal.ts`，注入模型默认参数
- 特别处理各模型 `duration` 格式差异（integer vs string vs string+suffix）
- **验收**：每个模型发送的请求体包含正确参数名和完整默认参数

### Phase 2：提示词拼接引擎

- 创建 `video-prompt-engine/enricher.ts`
- 修改 `video.worker.ts` 接入拼接引擎
- 实现角色外观描述解析（从 `characters` JSON → 查询 appearance → 拼接）
- **验收**：视频 prompt 包含画风/场景/角色/镜头信息，生成效果与分镜图片一致性提升

### Phase 3：前端预览面板

- 创建 `video-prompt-engine/request-builder.ts`
- 新增 `VideoRequestPreview` 组件
- 在 `VideoPanelCardBody` 中集成预览面板
- 实现数据来源标签、折叠/展开、复制、编辑覆盖
- **验收**：用户可在生成前预览完整请求体，切换模型时实时更新

---

## 9. 风险与约束

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 拼接后 prompt 超过模型字符限制 | Wan 800字符、Sora 5000字符 | 按模型限制截断，优先保留动作描述层 |
| 角色外观查询增加 DB 开销 | Worker 性能下降 | 批量查询 + 缓存；仅在面板有 characters 时查询 |
| 用户手动编辑后不期望被覆盖 | 用户体验 | 标记 `isUserOverride`，一旦编辑不再自动拼接；提供"重置"按钮恢复自动模式 |
| 不同模型 prompt 风格偏好不同 | 部分模型效果下降 | 可为每个模型定义独立的拼接模板（v2 迭代） |

---

## 10. 附录：跨模型能力对比总表

| 能力 | Kling 2.6 | Kling 2.5 | Veo 3.1 | Veo 3 | Wan 2.6 | Hailuo 2.3 | Ray 2 | Gen4 | Sora 2 | Kling 3 (FAL) |
|------|-----------|-----------|---------|-------|---------|------------|-------|------|--------|--------------|
| negative_prompt | Yes | Yes | Yes | Yes | Yes | **No** | **No** | **No** | **No** | Yes |
| 最大时长 | 10s | — | 8s | — | 15s | 10s | 9s | 10s | 12s | 15s |
| 音频生成 | Yes | No | Yes | Yes | Yes+口型 | No | No | No | No | Yes |
| Prompt 扩写 | No | No | No | No | Yes | Yes | No | No | No | No |
| 多镜头 | No | No | No | No | Yes | No | No | No | No | Yes |
| 末帧图片 | No | Yes | Yes | No | No | No | Yes | No | No | Yes |
| cfg/guidance | No | 0.5 | No | No | No | No | No | No | No | 0.5 |
| 参考图 | No | No | 1-3张 | No | No | No | No | No | No | elements |
| 镜头概念 | No | No | No | No | No | No | **34种** | No | No | No |
| 种子控制 | No | No | Yes | Yes | Yes | No | No | Yes | No | No |
| 最大分辨率 | 1080p | — | 1080p | — | 1080p | 1080p | 720p | 720p | 720p | — |
| 图片参数名 | start_image | start_image | image | image | image | first_frame_image | start_image | image | image_url | start_image_url |

---

## 11. 成功指标

| 指标 | 目标 |
|------|------|
| 视频-图片一致性 | 用户反馈"差距过大"问题下降 |
| 首次生成满意率 | 提升（减少重复生成次数） |
| prompt 信息完整度 | 从平均 1 层（纯动作）提升至 4-6 层 |
| 默认参数覆盖率 | 100% 模型均设置推荐默认值 |
