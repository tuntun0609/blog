# 工具卡片插画生成规范

本文用于生成与工具箱现有封面一致的原创简笔编辑插画。目标是让新增图片在视觉上属于同一套系统，同时准确表达工具用途，并能直接用于工具卡片。

## 核心原则

- 使用原创编辑插画，提炼 Anthropic 式插画的宽泛视觉特征，但不复刻任何具体作品或品牌资产。
- 用一个清晰的动作表达工具的核心功能，不把产品界面截图重新画一遍。
- 插画必须在 `192 × 108` 的卡片缩略尺寸下仍然容易辨认。
- 同一套图片共享线条、人物比例、色彩明度、纸张质感和留白方式。
- 图片内不放工具名称或说明文字，信息由卡片标题和描述承担。

## 固定输出要求

| 项目 | 规则 |
| --- | --- |
| 用途 | 网站工具卡片封面 |
| 比例 | 严格横向 `16:9` |
| 当前参考尺寸 | `1672 × 941`，允许其他接近 16:9 的高分辨率输出 |
| 格式 | PNG |
| 文件名 | `public/tools/<tool-slug>-illustration.png` |
| 构图安全区 | 重要人物和物件集中在画面中央约 `70%` |
| 内容密度 | 1 个核心动作，2–4 组辅助物件 |
| 背景 | 浅色纸张底色，不要求统一为米白 |
| 页面显示 | Next Image 卡槽固定为 `16:9`，使用 `object-fit: cover` |

不要把关键物件贴近画面边缘。生成模型偶尔会产生与 16:9 相差 1 像素的尺寸，只要页面裁切不影响内容即可接受。

## 视觉语言

### 线条

- 主轮廓使用炭黑色手绘线。
- 线条略带抖动、粗细变化和不完美感。
- 轮廓必须清楚，不使用精密矢量图标式描边。
- 不使用复杂交叉排线；仅允许人物头发、裤装等局部出现轻微蜡笔或炭笔纹理。

### 形状与人物

- 人物造型简洁、友好、性别中性。
- 不设固定主角，不同工具可以使用不同人物。
- 人物与物件的比例可以轻微夸张，以提升隐喻的可读性。
- 物件使用简单几何结构和略微歪斜的手绘轮廓。
- 不追求写实透视、真实材质或精细光影。

### 质感

- 背景和色块保留轻微纸张、蜡笔或丝网印刷质感。
- 使用平面色块，不使用玻璃质感、3D 渲染或明显渐变。
- 阴影只用于轻微落地感，不使用写实投影。

### 色彩系统

颜色不必逐像素一致，但要维持接近的明度和饱和度。

| 用途 | 推荐颜色 |
| --- | --- |
| 主线条 | 炭黑 `#1F1F1C` |
| 主要强调色 | 珊瑚橙 `#F47D5E` |
| 次要强调色 | 柔和群青 `#6179C8` |
| 自然色 | 灰鼠尾草绿 `#92A187` |
| 小面积亮点 | 暖黄 `#F2C14E` |

背景按工具类别区分：

- 视频与音频工具：浅桃色或浅杏色。
- 图片工具：淡薄荷、浅天蓝或两者之间的低饱和色。
- 文本与开发工具：淡薰衣草色。

同一类别可以轻微改变背景色相，但背景明度、纸张纹理和主体对比度必须一致。

## 如何设计工具隐喻

先把工具功能改写成一个动词，再设计画面：

1. 找出用户实际完成的动作，例如“转换”“移除”“裁剪”“校正”“提取”“验证”“整理”“还原”“比较”。
2. 把输入、动作和结果压缩到同一个场景中。
3. 让人物真正操作物件，而不是站在旁边指向一个界面。
4. 优先使用机器、纸张、框线、节点、色块、放大镜和绳带等通用视觉物件。
5. 如果需要表达前后变化，用左右、内外或穿过装置的关系完成，不增加多个分镜。

当前工具的参考隐喻：

| 工具 | 核心动作 | 推荐场景 |
| --- | --- | --- |
| 视频转码 | 转换 | 人物摇动转换机器，媒体卡片进入并变成视频、音频等输出 |
| 图片背景去除 | 移除 | 人物从主体后方剥下一张背景纸，主体成为干净剪纸 |
| 图片裁剪 | 裁剪 | 人物移动两个超大的 L 形角标，重新限定图片范围 |
| 文档校准 | 校正 | 人物拖动斜拍纸张的四个角点，使梯形页面变成水平矩形 |
| 图片主题色提取 | 提取 | 人物用吸管从图片中取色，颜色落入一排圆形色板 |
| OpenAI Verify | 检测来源信号 | 人物用放大镜查看图片和音频中的隐藏指纹、溯源节点 |
| JSON Viewer | 整理与查看 | 放大镜把混乱节点揭示为清楚的树状层级 |
| JSON 字符串转换 | 双向转换 | 双向机器在嵌套节点与连续节点绳带之间转换 |
| 文字内容 Diff | 比较 | 两条抽象文本带对齐，放大镜找出被移除和插入的色块 |

## 禁止项

每次提示词都应明确排除以下内容：

- 文字、字母、数字和可读代码。
- 工具名称、按钮、标签和产品界面截图。
- Logo、商标、水印和品牌专用符号。
- 对 Anthropic 或其他品牌具体插画的复制。
- OpenAI 结形标志、ChatGPT 标志或其他 OpenAI 品牌图形。
- 写实摄影、3D、玻璃拟态、霓虹光和复杂渐变。
- 过多人物、过多小物件、复杂背景故事和装饰性场景。
- 被画布切断的人物、工具或输出结果。

特殊工具可以额外增加限制。例如生成 OpenAI Verify 封面时，应明确它表示内容溯源信号检测，不是事实核查或真假判定。

## Imagegen 通用提示模板

使用内置 Imagegen，每项工具单独调用一次。不要在一次提示中要求生成多张不同工具图片。

```text
Use case: stylized-concept
Asset type: 16:9 website tool-card cover illustration for <工具用途>
Primary request: Create an original conceptual editorial illustration that instantly communicates <核心动作和结果>.
Scene/backdrop: a flat, very pale <类别背景色> paper-textured background.
Subject: one relaxed, gender-neutral person <人物动作>. <输入物件> becomes <输出结果>. Keep the metaphor immediately readable without labels.
Style/medium: original minimalist hand-drawn editorial line illustration; loose imperfect charcoal-black strokes, slightly wobbly geometry, simple flat color blocks, understated visual wit, generous whitespace, subtle analog paper grain. Capture the broad warmth and restraint associated with Anthropic-style editorial drawings while remaining fully original; do not reproduce any existing illustration or brand asset.
Composition/framing: strict 16:9 landscape composition; scene centered inside the middle 70% safe area; full figure and all objects completely visible; readable when reduced to 192 by 108 pixels; one core action and only 2–4 supporting visual groups.
Color palette: very pale <类别背景色> background, charcoal-black linework, restrained coral-orange shapes, muted ultramarine-blue accents, optional sage green and one small warm yellow accent.
Constraints: no text, no letters, no numbers, no readable code, no UI screenshot, no logos, no trademarks, no watermark, no borders, no photorealism, no 3D, no gradients, no cropped objects.
```

只替换模板中的功能、背景色、人物动作、输入和输出。不要为了显得丰富而擅自增加故事人物、品牌颜色或装饰道具。

## 单点修图模板

如果初稿只有一个明确问题，应编辑原图，不要重新设计整张图：

```text
Use case: precise-object-edit
Asset type: 16:9 website tool-card cover illustration
Input images: Image 1 is the edit target.
Primary request: change only <唯一需要修改的内容>.
Constraints: preserve absolutely everything else unchanged, including canvas dimensions, background, person, objects, positions, linework, palette, paper texture, composition, and style. Do not add or remove any other element. No text, no logo, no watermark.
```

一次只修一个问题。常见修正包括：

- 某个色块与背景太接近。
- 某个关键物件被裁切。
- 隐喻不够明确，需要替换单个辅助物件。
- 模型意外生成文字、Logo 或水印，需要移除。

## 批量生成流程

1. 从工具页数据中确认真实上线的工具清单，不为未引用资产默认生成图片。
2. 为每个工具写出“输入 → 动作 → 输出”的一句话隐喻。
3. 先选视频、图片、文本三类各一个代表工具生成样图。
4. 样图确认后，为其余工具分别调用 Imagegen。
5. 逐张检查功能含义、风格、构图、文字和品牌元素。
6. 对单一瑕疵使用单点修图，不要整张重做。
7. 将最终图片复制到 `public/tools`，保留 Imagegen 原始输出。
8. 使用新文件名，不覆盖原有 SVG，方便回滚。
9. 更新 `src/app/tools/page.tsx` 中对应的 `cover` 路径。
10. 在桌面端和移动端检查实际卡片裁切与加载情况。

## 接入与验证

新增图片后至少执行：

```bash
sips -g pixelWidth -g pixelHeight public/tools/*-illustration.png
bun x ultracite check src/app/tools/page.tsx
bun x tsc --noEmit
git diff --check
```

浏览器 QA 检查：

- 9 张或当前全部工具图片均成功加载，`naturalWidth` 和 `naturalHeight` 不为 0。
- 桌面三列卡片中的人物和关键物件没有被裁掉。
- `390px` 宽度下没有横向溢出，单列卡片仍能看懂插画。
- 浏览器控制台没有图片加载错误或 LCP 警告。
- 首屏第一张卡片封面使用 `loading: 'eager'`，其余图片保持懒加载。
- 图片的 `alt` 保持为空，因为工具名称已经由同一卡片中的可见文本表达，封面属于装饰性内容。

## 验收清单

生成完成前逐张确认：

- [ ] 是横向 16:9 构图。
- [ ] 主体位于中央安全区。
- [ ] 缩小到卡片尺寸后仍能辨认核心动作。
- [ ] 只有一个主要动作，没有不必要的分镜。
- [ ] 辅助物件不超过 2–4 组。
- [ ] 使用对应类别的浅色背景。
- [ ] 炭黑手绘线、平面色块和纸张质感与现有图片一致。
- [ ] 没有文字、字母、数字、代码、Logo、商标或水印。
- [ ] 没有被意外裁切的人物和关键物件。
- [ ] 文件已保存到项目并更新页面引用。
- [ ] 原有 SVG 仍然保留，可随时回滚。

