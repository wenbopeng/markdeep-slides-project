# 增强版 Markdeep 幻灯片生成器

这是一个基于 [Markdeep](https://casual-effects.com/markdeep/) 和 [markdeep-slides](https://github.com/doersino/markdeep-slides) 的高度定制化幻灯片制作工具。它旨在通过简单的 Markdown 语法，帮助您快速创建功能丰富、样式精美的演示文稿。

本项目在原有基础上进行了大量优化和功能增强，尤其侧重于提升实用性和视觉表现力。新增了包括但不限于**自动导航栏、自动目录、自定义比例双栏、大纲逐条播放、Obsidian Callout 语法兼容**等现代化功能。


> [!attention] Obsidian插件
> 
> 我为这个项目开发了一个Obsidian插件： [wenbopeng/Obsidian-markdeep-slides](https://github.com/wenbopeng/Obsidian-markdeep-slides)


# 示例


- 教程与示例：[Tutorial](https://wenbopeng.github.io/markdeep-slides-pages/Tutorial.html)
- 示例1：[Example1](https://wenbopeng.github.io/markdeep-slides-pages/Example1)
- 示例2：[Example2专利法第九章-专利侵权-04专利侵权的抗辩事由](https://wenbopeng.github.io/markdeep-slides-pages/Example2专利法第九章-专利侵权-04专利侵权的抗辩事由.html)

https://github.com/user-attachments/assets/52670bdc-39aa-4d61-992d-f7d9d5d3ad4b

---

## ✨ 核心功能

- **自动导航与目录 (Auto Navigation & TOC)**: 自动根据一级标题（或自定义标记）生成顶部导航栏和目录页。
- **章节标题显示 (Chapter Title Display)**: 在每个二级标题（H2）页面左下角自动显示其所属的一级标题（H1）。
- **逐条播放 (Incremental Display)**:
    - **大纲播放**: 幻灯片内的列表可以逐条呈现。
    - **自定义分步**: 使用简单的语法精确控制页面上任何元素的出现顺序。
- **双栏布局 (Two-Column Layout)**: 支持自定义左右两栏的宽度比例。
- **嵌套围栏语法 (Nested Fenced Blocks)**: 支持多层嵌套的 `:::` 围栏块，可使用更多冒号（如 `::::` 或 `:::::` ）来包裹内层块。
- **全局概览模式 (Overview Mode)**: 按 `O` 键可切换到缩略图网格视图，快速浏览和跳转到任意幻灯片。
- **Obsidian Callout 兼容**: 完美支持 Obsidian 风格的 `[!NOTE]` 标注块语法。
- **列表标注 (List Admonition)**: 为列表项添加特定前缀，即可实现不同颜色的高亮。
- **字号控制 (Font Size Control)**: 可通过简单标记将单张幻灯片切换为小号或微号字体。
- **现代化主题**: 提供了一个基于 `simple.css` 的清爽、现代化的主题。

---

## 🚀 快速上手

1.  **下载项目**: 将整个项目文件夹下载到您的本地。
2.  **创建新文件**: 在项目根目录创建一个新的 HTML 文件（例如 `my-slides.html`）。
3.  **编写内容**: 将以下模板复制到您的 HTML 文件中，然后在 `<!-- Your Markdeep content starts here -->` 之后开始用 Markdown 编写您的幻灯片内容。

```html
<meta charset="utf-8">

<!-- Your Markdeep content starts here -->

**幻灯片标题**
副标题

作者

作者单位

%%章节标题%%

# 小节标题

## 幻灯片标题

- 关键点1
- 关键点2

| 类别 | 内容 |
|------|------|
| 项1 | 描述 |
| 项2 | 描述 |

## 幻灯片标题

- 关键点1
- 关键点2

> [!note] note的标题
> 
> note的详情

# 小节标题

## 幻灯片标题
- 关键点1
- 关键点2

%%章节名称%%

# 小节标题

## 幻灯片标题

> [!error] error的标题
> 
> error的详情

## 幻灯片标题
- 关键点1
- 关键点2



<!-- Markdeep slides stuff -->
<script>
markdeepSlidesOptions= {
    aspectRatio: 16 / 9,      // 幻灯片的宽高比
    theme: "/Users/wenbo/Pandoc/MarkDeep/markdeep-slides/themes/simple.css",          // 主题 – "simple"、"deepsea"、"serif" 或自定义样式表路径
    fontSize: 28,             // 基础字号，相对于幻灯片显示尺寸
    diagramZoom: 1.0,         // markdeep 图表缩放系数
    totalSlideNumber: true,  // 是否在页码旁显示总页数？
    progressBar: true,        // 是否在每张幻灯片上显示演示进度条？
    breakOnHeadings: true,   // 是否不仅遇到“---”时分页，一级、二级标题也强制分页？
    slideChangeHook: (oldSlide, newSlide) => {},  // 切换幻灯片时执行的函数，接收旧页码和新页码
    modeChangeHook: (newMode) => {}               // 模式切换时执行的函数，接收新模式，如 "draft" 或 "presentation"
};
</script>
<link rel="stylesheet" href="markdeep-slides/lib/markdeep-relative-sizes/1.11/relativize.css">
<link rel="stylesheet" href="markdeep-slides/markdeep-slides.css">
<script src="markdeep-slides/markdeep-slides.js"></script>

<!-- Markdeep stuff -->
<script>
    markdeepOptions = {
        tocStyle: "none",
        detectMath: true,
        onLoad: function() {
            initSlides();
        }
    };
</script>
<style class="fallback">body{visibility:hidden;white-space:pre;font-family:monospace}</style>
<script src="markdeep-slides/lib/markdeep/1.11/markdeep.min.js" charset="utf-8"></script>
<script>window.alreadyProcessedMarkdeep||(document.body.style.visibility="visible")</script>
```

一个更加简洁的方式是在Markdown文件的底部添加一行代码，你会看到神奇的结果：

```html
<script src="markdeep-slides/slides-init.js"></script>
```


4.  **打开文件**: 在浏览器中打开您创建的 HTML 文件即可看到效果。

---

## 📖 功能详解

### 1. 自动导航与目录

系统会智能地为你创建导航和目录。

- **定义章节**: 在文档中，使用 `%% 章节名 %%` 语法来定义一个章节的开始。
- **自动回退**: 如果没有找到 `%%` 标记，系统会自动将所有一级标题（H1）作为章节。如果连 H1 都没有，则会使用二级标题（H2）。
- **效果**:
    - **目录页**: 自动在标题页后生成一个可点击的目录页。
    - **顶部导航栏**: 在每张幻灯片顶部生成一个导航栏，高亮当前所在章节，并可点击跳转。

**示例**:
```markdown
%%第一章：引言%%

# 这是一个H1标题

它不属于任何章节，但其后的H2页面会显示它作为章节标题。


%%第二章：核心概念%%

## 这是一个H2标题

这张幻灯片的顶部导航栏会高亮 "第二章：核心概念"。
```

### 2. 章节标题显示

为了在浏览时保持上下文清晰，当一张幻灯片以二级标题（H2）开头时，其左下角会自动显示它所属的一级标题（H1）内容。

**示例**:
```markdown
# 第一章：计算机基础

本页是章节封面。

---

## 1.1 冯·诺依曼体系结构

这张幻灯片的左下角会显示 "第一章：计算机基础"。
```

### 3. 逐条播放 (Builds)

#### 全局大纲播放

在幻灯片中任意位置加入 `[incremental]` 和 `[incremental-flat]`标记，该幻灯片中的所有列表项将会逐条出现。

**示例**:
```markdown
## 议程

[incremental]

- 背景介绍
- 方案分析
- 总结与展望
```

#### 自定义分步播放

使用 `:::` 围栏语法，可以精确控制页面上任何元素的出现。

- `:::incremental` 或 `:::appear`: 块内的每个顶级元素（段落、列表、图片等）将成为一个步骤。
- `:::appearN`: 通过数字 `N` 指定出现的顺序。数字越小，越先出现。
- `:::incremental-flat`: 块内的列表项会逐个出现。

**示例**:
```markdown
:::appear1
第一步出现的内容。
:::

:::appear3
第三步出现的内容。
:::

:::appear2
第二步出现的内容。
:::
```

### 4. 双栏布局

使用 `;;;;;;` 作为分隔符来创建双栏。默认是 `1:1` 比例。

要自定义比例，使用 `;;;N:M;;;` 语法。

**示例**:
```markdown
## 双栏对比



**左侧内容 (占 2/3 宽度)**

- 优点一
- 优点二

;;;2:1;;;

**右侧内容 (占 1/3 宽度)**

- 缺点一
- 缺点二
```


### 5. Obsidian Callout 语法

直接使用 Obsidian 的 Callout 语法，它们会被渲染成美观的标注块。

**支持的类型**: `note`, `info`, `todo`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `error`, `bug`, `example`, `quote`。

**示例**:
```markdown
> [!NOTE] 这是一条笔记
>
> 你可以在这里写下笔记内容。

> [!WARNING] 这是一个警告
>
> 请注意相关风险。
```

### 6. 列表标注 (List Admonition)

通过在列表项的开头添加特殊符号，可以快速高亮该行。

- `!` : 红色
- `?` : 橙色
- `&` : 蓝色
- `%` : 绿色
- `@` : 紫色

**示例**:
```markdown
- 普通列表项
- ! 这是一个重要的红色警告
- ? 这是一个需要思考的问题
```
*注意：符号与文本之间需要一个空格。*

### 7. 字号控制

如果某张幻灯片内容过多，可以使用标记来缩小字体。

- `[small-text]`: 使用小号字体。
- `[tiny-text]`: 使用微号字体。

**示例**:
```markdown
## 一张内容很多的幻灯片

[small-text]

这里可以放入大量文字，它们会以较小的字号显示，以适应页面。
...
```

也可以使用围栏语法自定义字号

```

## 使用围栏语法自定义幻灯片不同元素的字号

:::big

文字变大

:::


文字正常

:::small

文字变小

:::


:::tiny

文字更小

:::

```

### 8. 嵌套围栏语法 (Nested Fenced Blocks)

当你需要在一个围栏块内部再使用围栏块时，可以使用更多的冒号来区分层级。外层使用更多冒号，内层使用较少冒号。

**规则**：
- 外层围栏使用 N 个冒号（如 `::::`）
- 内层围栏使用少于 N 个冒号（如 `:::`）
- 结束标记的冒号数量必须与开始标记相同

**示例**：
````markdown
::::two-column
左侧内容

:::appear1
这部分会先出现
:::

;;;;;;

右侧内容

:::appear2
这部分会后出现
:::

::::
````

这个例子展示了在 `two-column` 布局内部嵌套使用 `appear` 块。

### 9. 全局概览模式 (Overview Mode)

在演示过程中，你可以随时按 **`O`** 键进入概览模式，以网格形式查看所有幻灯片的缩略图。

**功能特点**：
- 所有幻灯片以缩略图网格排列
- 当前幻灯片以红色边框高亮显示
- 悬停时显示蓝色边框和阴影效果
- 点击任意缩略图可跳转到该幻灯片
- 再次按 `O` 键或点击缩略图可退出概览模式

**键盘快捷键**：
| 按键 | 功能 |
|------|------|
| `O` | 切换概览模式 |
| `F` 或 `Esc` | 切换全屏演示模式 |
| `→` / `↓` / `Space` / `PageDown` | 下一页 |
| `←` / `↑` / `PageUp` | 上一页 |
| `.` | 黑屏 |
| `N` | 打开演讲者备注窗口 |
| `T` | 计时器开始/重置 |

## 支持的布局方式

### 1. 默认标准布局 (Single Column)
这是最基础的布局，内容从上到下垂直排列。

*   **启用方式**：无需任何特殊标记。直接在 Markdown 中书写内容即可。
*   **适用场景**：标题页、纯文本列表、大图展示。

### 2. 双栏布局 (Two Column)
将幻灯片内容分为左右两栏，默认比例为 1:1，但支持自定义比例。

*   **启用方式 1（基础语法 - 默认 1:1）**：
    在幻灯片内容中包含 `;;;` 分隔符。代码会自动识别并将 `;;;` 之前的内容放入左栏，之后的内容放入右栏。如果幻灯片有标题（H1-H6），标题会保留在顶部，不会被卷入分栏。
    ```markdown
    # 标题
    左侧内容
    ;;;
    右侧内容
    ```

*   **启用方式 2（通过 Fence Block - 推荐）**：
    使用 `:::two-column` 包裹内容，并用 `;;;` 分隔左右。
    ```markdown
    :::two-column
    左侧内容
    ;;;
    右侧内容
    :::
    ```

*   **启用方式 3（自定义比例）**：
    在 Fence Block 头部指定比例，或者在分隔符中指定比例。
    *   **头部指定**：`:::two-column 2:1` （左侧占 2 份，右侧占 1 份）
    *   **分隔符指定**：`左侧内容 ;;; 2:1 ;;; 右侧内容` （这种写法在旧版兼容逻辑里存在，代码中有正则匹配 `;;; 2:1 ;;;`）

*   **样式细节**：左右栏会有浅蓝色底纹 (`background-color: #e6f2ff`)，在 `.css` 文件中定义。

### 3. 双栏逐步显示布局 (Two Column Appear)
这是双栏布局的变体。不仅分栏，而且两栏内容会按顺序“逐步出现”（动画效果）。

*   **启用方式**：
    使用 `:::two-column-appear` 包裹内容。
    ```markdown
    :::two-column-appear
    左侧内容（先出现）
    ;;;
    右侧内容（按下一页键后出现）
    :::
    ```
*   **实现原理**：JS 会自动给左栏添加 `appear1` 类，给右栏添加 `appear2` 类。配合 CSS 中的 `[class*="appear"]` 样式，实现初始透明度低，激活后不透明的效果。

### 4. 栅栏块布局 (Fence Blocks / Wrappers)
除了上述特定的分栏，代码还通用地支持用 `:::` 包裹内容来应用特定样式类。

*   **大字/小字布局**：
    *   `:::big` -> 字体变大 (`font-size: 1.5em`)
    *   `:::small` -> 字体变小 (`font-size: 0.8em`)
    *   `:::tiny` -> 字体极小 (`font-size: 0.6em`)
*   **逐步显示块 (Appear Blocks)**：
    *   `:::appear` -> 整个块默认半透明，点击后显示。
    *   `:::appear1`, `:::appear2` -> 指定显示顺序。
    *   **快捷语法**：`::::appear` (四个冒号) 也可以触发，代码中有专门正则 `startFourColonRegex` 处理它，优先级比三个冒号高。

### 5. 全页特殊文本模式 (Slide-level Text Sizing)
这是针对**整张**幻灯片的设置，而不是某个块。

*   **启用方式**：
    在幻灯片任意位置（通常在段落中）包含特定标记：
    *   `[small-text]` -> 整页内容添加 `small-text` 类。
    *   `[tiny-text]` -> 整页内容添加 `tiny-text` 类。
    *   代码会在解析时自动移除这些标记文字。

### 6. 列表逐步显示 (Incremental Lists)
控制列表项（li）是否一项一项显示。

*   **启用方式**：
    *   **全局设置**：在 JS配置项中设置 `incremental: true`。
    *   **单页标记**：在幻灯片中写入 `[incremental]` 或 `[build]`。
    *   **单页标记 (Flat)**：`[incremental-flat]` (只对直接子列表生效，不递归)。
    *   **块级标记**：`:::incremental` 包裹列表。


目前主要依靠 **Markdown 文本标记（`[tag]`）** 和 **自定义栅栏块（`:::type`）** 来控制布局。

**最核心的布局逻辑在 `processFencedBlocks` 函数中**，特别是对 `two-column` 的处理非常详细，支持了比例分割。

**潜在的局限性：**
目前的分栏逻辑是硬编码的“左右两栏”。如果想要“三栏”或者“田字格”布局，目前的 JS 解析逻辑（通过 split `;;;`）可能无法直接支持，需要修改代码来扩展。

---

## 协议

本项目基于 MIT 协议开源。
