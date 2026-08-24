---
name: Tuntun Personal Site
description: 克制、清晰，并以真实构建内容为中心的个人技术网站。
colors:
  ink: "#171717"
  paper: "#ffffff"
  muted: "#737373"
  panel: "#f7f9fc"
  violet: "oklch(0.491 0.27 292.581)"
  violet-dark-fill: "oklch(0.432 0.232 292.759)"
  lavender-dark-foreground: "oklch(0.811 0.111 293.571)"
  border: "oklch(0.922 0 0)"
typography:
  display:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "clamp(2.65rem, 5vw, 3.8rem)"
    fontWeight: 760
    lineHeight: 1.04
  body:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.68rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "0.875rem"
  xl: "1.125rem"
spacing:
  xs: "0.5rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "3rem"
  xl: "6rem"
components:
  chip-active:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1rem"
---

# Design System: Tuntun Personal Site

## Overview

**Creative North Star: “公开构建的编辑台”**

界面像一张持续被整理的工作台：大面积安静背景承载真实项目、文章封面与技术内容，紫色只负责标记当前状态和关键路径。表达依赖排版、网格、边界与内容本身，不用装饰替代证据。

系统整体克制但不冷淡。无衬线正文保持现代与易读，等宽小标签提供工程语境；页面允许少量有目的的互动和实验性内容，但导航、阅读与检索始终清楚。

**Key Characteristics:**

- 明亮纸面与近黑文字组成主要阅读环境，并提供等价暗色主题。
- 紫色强调稀少且明确；暗色主题严格区分深紫填充与浅薰衣草前景。
- 大标题、紧凑标签和充足留白建立信息层级。
- 真实封面、项目截图和代码内容优先于抽象装饰。

## Colors

中性纸面承担绝大多数面积，紫色是唯一稳定的交互强调色。

### Primary

- **构建紫** (`oklch(0.491 0.27 292.581)`): 用于当前分类、关键链接和焦点反馈；避免大面积铺满页面。
- **暗夜紫** (`oklch(0.432 0.232 292.759)`): 暗色主题中只用于实心强调填充，不用作深色背景上的链接或细文字。
- **浅薰衣草** (`oklch(0.811 0.111 293.571)`): 暗色主题中的链接、分类和交互前景；与暗色纸面的浏览器实测对比度为 10.67:1。

### Neutral

- **墨黑** (`#171717`): 浅色主题的主文字与强边界。
- **纸白** (`#ffffff`): 浅色主题的页面与卡片底色。
- **记录灰** (`#737373`): 摘要、日期和辅助说明。
- **面板灰** (`#f7f9fc`): 图片加载底色和轻量内容面板。
- **细线灰** (`oklch(0.922 0 0)`): 分区、卡片与输入边界。

**The One Accent Rule.** 紫色只承担选择和重点，不与额外的装饰性色彩竞争。

**The Dark Contrast Rule.** 暗色主题以 `--home-accent` 的暗夜紫承担填充，以 `--home-blue` 的浅薰衣草承担前景、链接和细线交互状态；不得交换二者职责。

## Typography

**Display Font:** Noto Sans（回退至系统无衬线字体）
**Body Font:** Noto Sans（回退至系统无衬线字体）
**Label/Mono Font:** Geist Mono（回退至系统等宽字体）

**Character:** 大标题直接、宽松，正文平实易读；等宽字体只用于日期、分类和技术性短标签，不用于长段正文。

### Hierarchy

- **Display**（760，`clamp(2.65rem, 5vw, 3.8rem)`，1.04）：页面唯一主标题或身份命题。
- **Headline**（700，`clamp(1.45rem, 2vw, 1.75rem)`，1.3）：主要分区标题。
- **Title**（700，`1.02rem–2rem`，1.3–1.38）：卡片与项目标题。
- **Body**（400，`0.96rem–1rem`，1.8）：说明、摘要和文章正文。
- **Label**（700，`0.62rem–0.72rem`，1.4）：分类、日期与状态。

**The Quiet Type Rule.** 编辑感来自比例、对齐和留白，不依赖衬线或全大写装饰。

## Layout

全站内容容器上限为 `68rem`，桌面端保留宽阔外边距，移动端使用约 `1rem` 页面边距。布局优先使用明确网格；重点内容允许横跨多列，次要内容紧凑排列。移动端自然退回单列，不通过缩小文字强行保留桌面结构。

垂直节奏以 `1rem`、`1.5rem`、`3rem` 和 `6rem` 为主。分区顶部间距大于标题与内容之间的间距。

## Elevation & Depth

系统默认扁平，不用常驻投影区分层级。深度来自纸面与面板的色差、细边框、图片裁切，以及悬停时轻微的边界与位移反馈。

**The Flat-by-Default Rule.** 静止状态不使用漂浮阴影；交互反馈也应短暂、轻量。

## Shapes

导航与图标按钮可使用圆形或胶囊形；内容卡片使用中等圆角和细边框，图片遵循卡片内部较小一档的圆角。避免把每一块内容都包进独立容器。

## Components

### Buttons

- **Shape:** 小型按钮与筛选使用紧凑圆角或胶囊形。
- **Primary:** 语义主色背景配高对比文字。
- **Hover / Focus:** 使用颜色、细线或清晰焦点环反馈，不做大幅弹跳。
- **Secondary / Ghost:** 保持透明或中性底色，让内容而非控件成为视觉主体。

### Chips

- **Style:** 未选中状态使用边框与纸面背景；选中状态使用构建紫和高对比文字。暗色主题使用暗夜紫填充，链接式分类前景使用浅薰衣草。
- **State:** 必须通过颜色之外的 `aria-current` 或等价语义表达选择状态。

### Cards / Containers

- **Corner Style:** 中等圆角，外卡片通常约 `1.125rem`。
- **Background:** 与页面同色或轻微中性面板色。
- **Shadow Strategy:** 默认无阴影。
- **Border:** 使用低对比细线，焦点和悬停可转为构建紫。
- **Internal Padding:** 通常为 `1rem–1.5rem`。
- **Blog Index Exception:** `/blog` 首页的代表作和文章归档只保留一层卡片外框；图片不再增加内框，区块不使用装饰性横线。

### Inputs / Fields

- **Style:** 中性底色、低对比边界和清楚的可点击高度。
- **Focus:** 使用语义焦点环与边界变化。
- **Error / Disabled:** 沿用 shadcn 语义状态，不创建页面专属错误色。

### Navigation

粘性顶部导航使用半透明纸面和细分隔线；当前栏目通过细下划线表示。移动端可隐藏次要文字链接，但保留品牌、文章、工具、GitHub 与主题切换。

## Do's and Don'ts

### Do:

- **Do** 让真实文章封面、项目截图和代码内容承担视觉证据。
- **Do** 使用语义色变量同时支持明暗主题。
- **Do** 在暗色背景上使用浅薰衣草作为紫色前景，把暗夜紫保留给实心填充。
- **Do** 为键盘、触摸、减少动态效果和窄屏提供完整状态。
- **Do** 用网格和信息密度变化形成编辑节奏。

### Don't:

- **Don't** 使用大面积渐变、玻璃拟态或发光边框制造“技术感”。
- **Don't** 把每个段落都放进同质卡片。
- **Don't** 用等宽字体承载长中文正文。
- **Don't** 在暗色背景上把暗夜紫用作链接或细文字。
- **Don't** 覆盖 `src/components/ui` 中 shadcn 组件的原始视觉实现。
