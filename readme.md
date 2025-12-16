# 增强版 Markdeep 幻灯片生成器

这是一个基于 [Markdeep](https://casual-effects.com/markdeep/) 和 [markdeep-slides](https://github.com/doersino/markdeep-slides) 的高度定制化幻灯片制作工具。它旨在通过简单的 Markdown 语法，帮助您快速创建功能丰富、样式精美的演示文稿。

本项目在原有基础上进行了大量优化和功能增强，尤其侧重于提升实用性和视觉表现力。新增了包括但不限于**自动导航栏、自动目录、自定义比例双栏、大纲逐条播放、Obsidian Callout 语法兼容**等现代化功能。


> [!attention] Obsidian插件
> 
> 我为这个项目开发了一个Obsidian插件： [wenbopeng/Obsidian-markdeep-slides](https://github.com/wenbopeng/Obsidian-markdeep-slides)





- 教程与示例：Tutorial.html
- 示例1：Example1.html
- 示例2：Example2专利法第九章-专利侵权-04专利侵权的抗辩事由.html

https://github.com/user-attachments/assets/52670bdc-39aa-4d61-992d-f7d9d5d3ad4b

---

## ✨ 核心功能

- **自动导航与目录 (Auto Navigation & TOC)**: 自动根据一级标题（或自定义标记）生成顶部导航栏和目录页。
- **章节标题显示 (Chapter Title Display)**: 在每个二级标题（H2）页面左下角自动显示其所属的一级标题（H1）。
- **逐条播放 (Incremental Display)**:
    - **大纲播放**: 幻灯片内的列表可以逐条呈现。
    - **自定义分步**: 使用简单的语法精确控制页面上任何元素的出现顺序。
- **双栏布局 (Two-Column Layout)**: 支持自定义左右两栏的宽度比例。
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

---

## 协议

本项目基于 MIT 协议开源。
