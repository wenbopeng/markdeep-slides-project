// 增加了底部显示幻灯片章节标题的功能
// 帮我修改这个markdeep的代码， 我希望在每一个二级标题页的左下方有一个容器, 可以展示其所属的一级标题（章节标题）的文字内容, 也就是说, 在该内容在幻灯片内部的左下方设置一个展示区域，展示所属章节. 用简体中文告诉我该怎么修改
// 有一个问题, 就是二级标题页(a)，由于靠近后面的一级标题页(B)，会展示(B)的内容, 而不是展示前面的，a自己所属的一级标题(A)
//太棒啦。 完全符合我的要求。 但为什么要播放的时候才能正常显示呢？如果幻灯片是在非播放状态， 这些章节标题会挤在一起， 并没有出现在正确位置
var currentSlideNum = 0;
var slideCount = 0;

// Additions for top nav bar
var sections = [];

// make presenter notes window modifiable globally
var presenterNotesWindow;

// "window." makes this variable available to the presenter notes window
window.presenterNotesTimerStart = null;

var slideChangeHook = (oldSlide, newSlide) => {};
var modeChangeHook = (newMode) => {};

// state for incremental builds
var buildItems = [];
var currentBuildStep = 0;

// make options available globally
var options;

function processFencedBlocks(nodes) {
    var newNodes = [];
    var capturing = false;
    var capturedNodes = [];
    var blockType = '';

    var startRegex = /^:::(incremental|incremental-flat|appear\d*|big|small|tiny)\s*$/;
    var endRegex = /^:::\s*$/;

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        // Ensure node has textContent property before trimming
        var text = node.textContent ? node.textContent.trim() : '';
        var match = text.match(startRegex);

        if (match) {
            capturing = true;
            blockType = match[1];
            capturedNodes = [];
            continue;
        }

        if (endRegex.test(text)) {
            if (capturing) {
                var wrapper = document.createElement('div');
                wrapper.className = blockType;
                for(var j = 0; j < capturedNodes.length; j++) {
                    wrapper.appendChild(capturedNodes[j]);
                }
                newNodes.push(wrapper);
            }
            capturing = false;
            capturedNodes = [];
            blockType = '';
            continue;
        }

        if (capturing) {
            capturedNodes.push(node);
        } else {
            newNodes.push(node);
        }
    }

    // If a block was unclosed, append its nodes at the end to prevent content loss.
    if (capturedNodes.length > 0) {
        newNodes.push.apply(newNodes, capturedNodes);
    }
    
    return newNodes;
}

// process options, break rendered markdeep into slides on <hr> tags (unless the
// class "ignore" is set), kick off some other init tasks as well
function initSlides() {
    // override default options with any differing user-specified options
    processMarkdeepSlidesOptions();

    // Inject styles to fix MathJax background issue inside highlights
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        [class*="highlight-"] .MathJax_SVG,
        [class*="highlight-"] .MathJax_SVG * {
            background: transparent !important;
        }
    `;
    document.head.appendChild(style);

    // handle aspect ratio
    document.documentElement.style.setProperty('--aspect-ratio', options.aspectRatio);
    var sheet = document.createElement('style');
    sheet.innerHTML = "@page { size: 640px " + (640 / options.aspectRatio) + "px; }" +
        "@media print { .slide, .slide { --slide-width: 640px !important; --slide-height: " + (640 / options.aspectRatio) + "px; }";
    document.body.appendChild(sheet);

    // handle theme
    var link = document.createElement('link');
    link.setAttribute("rel", "stylesheet");
    if (/[/.]+/.test(options.theme)) {
        link.setAttribute("href", options.theme);
    } else {
        link.setAttribute("href", "markdeep-slides/themes/" + options.theme + ".css");
    }
    document.body.appendChild(link);

    // handle other options
    document.documentElement.style.setProperty('--font-size', options.fontSize);
    if (options.totalSlideNumber) {
        document.documentElement.style.setProperty('--slide-number-total-display', 'inline');
    }
    if (!options.progressBar) {
        document.documentElement.style.setProperty('--slide-progress-display', 'none');
    }

    // done with options processing – note that the diagramZoom,
    // breakOnHeadings, slideChangeHook and modeChangeHook options are
    // referenced later on and need no further processing at this stage

    // break document into slides
    var md = document.querySelector("body > .md");
    var es = Array.from(md.childNodes);

    function isHeadingSlideBreak(e) {
        return options.breakOnHeadings && (e.tagName == "H1" || e.tagName == "H2");
    }

    function isSlideBreak(e) {
        return (e.tagName == "HR" && e.className != 'ignore') || isHeadingSlideBreak(e);
    }

    // slide count used for progress bar
    var totalSlideCount = 1 + es.map(isSlideBreak).reduce((acc, curr) => curr ? acc + 1 : acc, 0);

    var slides = [];
    var currentSlide = [];
    var currentPresenterNotes = [];
    var currentH1Title = ""; // 记录当前一级标题
    
    sections = []; // Reset sections array
    var nextSectionName = null;

    for (var i = 0; i < es.length; i++) {
        var e = es[i];

        // Parse for a new section marker
        var sectionMatch = e.textContent.trim().match(/^%%(.*)%%$/);
        if (sectionMatch) {
            nextSectionName = sectionMatch[1];
            continue;
        }

        // A section starts with the first piece of content after its marker.
        // This content cannot be a slide break itself.
        if (nextSectionName && currentSlide.length === 0 && !isSlideBreak(e)) {
            sections.push({ name: nextSectionName, startSlide: slideCount });
            nextSectionName = null;
        }

     // 仅在当前 slide 完成后更新 H1，防止影响前一张幻灯片
    var nextH1Title = null;

    if (e.tagName === "H1") {
        nextH1Title = e.textContent.trim();
    }
        // create new slide when enountering <hr> or end of input
        if (isSlideBreak(e) || i == es.length - 1) {
            var slide = document.createElement('div');
            slide.className = "slide";
            slide.id = "slide" + slideCount;

            // slide number (skip title slide)
            if (slideCount != 0) {
                var sn = document.createElement('div');
                sn.className = "slide-number";
                sn.innerHTML = `${slideCount}<span class="slide-number-total">/${totalSlideCount}</span>`;
                slide.appendChild(sn);

                // Ensure total slide number is visible if option is set
                if (options.totalSlideNumber) {
                    sn.querySelector('.slide-number-total').style.display = 'inline';
                }
            }

            // slide progress bar
            if (slideCount != 0) {
                var sp = document.createElement('div');
                sp.className = "slide-progress";
                //sp.setAttribute("data-progress", slideCount / totalSlideCount);  // see commend in markdeep-slides.css
                sp.setAttribute("style", "width: calc(" + slideCount / (totalSlideCount - 1) + " * var(--slide-width));");
                slide.appendChild(sp);
            }

            // slide content
            var sc = document.createElement('div');
            sc.className = "slide-content";

            var processedNodes = processFencedBlocks(currentSlide);
            for (var j = 0; j < processedNodes.length; j++) {
                var se = processedNodes[j];

                if (se.tagName == "P" && se.innerHTML.trim().length == 0) {
                    // skip empty paragraphs
                } else {
                    sc.appendChild(se);
                }
            }

            // Highlight list items based on leading symbol
            var highlightMap = {
                '!': 'red',
                '?': 'orange',
                '&': 'blue',
                '%': 'green',
                '@': 'purple'
            };
            sc.querySelectorAll('li').forEach(function(li) {
                // Find the first child node that is a text node and not just whitespace
                var firstTextNode = null;
                for (var k = 0; k < li.childNodes.length; k++) {
                    var node = li.childNodes[k];
                    if (node.nodeType === 3 && node.textContent.trim().length > 0) { // Node.TEXT_NODE === 3
                        firstTextNode = node;
                        break;
                    }
                }

                if (firstTextNode) {
                    var text = firstTextNode.textContent.trim();
                    var matchedSymbol = null;

                    for (var symbol in highlightMap) {
                        if (text.startsWith(symbol)) {
                            matchedSymbol = symbol;
                            break;
                        }
                    }

                    if (matchedSymbol) {
                        var li = firstTextNode.parentNode;

                        // 1. Remove symbol from the first text node.
                        var escapedSymbol = matchedSymbol.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        firstTextNode.textContent = text.replace(new RegExp('^' + escapedSymbol + '\\s*'), '');

                        // 2. Create the wrapper span and insert it.
                        var span = document.createElement('span');
                        span.className = 'highlight-' + highlightMap[matchedSymbol];
                        li.insertBefore(span, firstTextNode);

                        // 3. Move all subsequent inline nodes into the new span.
                        var currentNode = firstTextNode;
                        while (currentNode) {
                            var nextNode = currentNode.nextSibling;
                            // Stop at block-level elements like nested lists.
                            var isBlock = currentNode.nodeType === 1 && ['UL', 'OL', 'P', 'DIV', 'BLOCKQUOTE'].indexOf(currentNode.tagName) !== -1;

                            if (isBlock) {
                                break;
                            }
                            
                            // Move the inline node into the span.
                            span.appendChild(currentNode);
                            
                            currentNode = nextNode;
                        }
                    }
                }
            });

            // Check for small-text marker
            if (sc.innerHTML.includes('[small-text]')) {
                slide.classList.add('small-text');
                            // Handle marker in its own paragraph or inline
                            sc.innerHTML = sc.innerHTML.replace(/<p>\s*\[small-text\]\s*<\/p>/g, '').replace(/\[small-text\]/g, '');
                        }

            // Check for tiny-text marker
            if (sc.innerHTML.includes('[tiny-text]')) {
                slide.classList.add('tiny-text');
                // Handle marker in its own paragraph or inline
                sc.innerHTML = sc.innerHTML.replace(/<p>\s*\[tiny-text\]\s*<\/p>/g, '').replace(/\[tiny-text\]/g, '');
            }

            // Check for build/incremental markers and global options
            if (sc.innerHTML.includes('[build]')) {
                sc.classList.add('build');
                sc.innerHTML = sc.innerHTML.replace(/<p>\s*\[build\]\s*<\/p>/g, '').replace(/\[build\]/g, '');
            } else if (sc.innerHTML.includes('[incremental]')) {
                sc.classList.add('incremental');
                sc.innerHTML = sc.innerHTML.replace(/<p>\s*\[incremental\]\s*<\/p>/g, '').replace(/\[incremental\]/g, '');
            } else if (sc.innerHTML.includes('[incremental-flat]')) {
                sc.classList.add('incremental-flat');
                sc.innerHTML = sc.innerHTML.replace(/<p>\s*\[incremental-flat\]\s*<\/p>/g, '').replace(/\[incremental-flat\]/g, '');
            } else {
                // No slide-specific marker found, check for global options
                if (options.incremental) {
                    sc.classList.add('incremental');
                } else if (options.incrementalFlat) {
                    sc.classList.add('incremental-flat');
                }
            }
                
                                                // Check for two-column marker ;;;
                                                if (sc.innerHTML.includes(';;;')) {
                                                    slide.classList.add('two-column');
                                    
                                                    // Find and separate the title (first H1-H6) from the content
                                                    const content = sc.innerHTML;
                                                    const titleRegex = /^\s*(<h[1-6][^>]*>.*?<\/h[1-6]>)/i;
                                                    const titleMatch = content.match(titleRegex);
                                                    const titleHTML = titleMatch ? titleMatch[1] : '';
                                                    const contentToSplit = titleMatch ? content.substring(titleMatch[0].length) : content;
                                                    
                                                    // Regex to find separator (inline or in <p>) and capture optional ratio
                                                    const separatorRegex = /<p>\s*;;;\s*(?:([0-9]+:[0-9]+)\s*)?;;;\s*<\/p>|;;;(?:\s*([0-9]+:[0-9]+)\s*)?;;;/;
                                                    const separatorMatch = contentToSplit.match(separatorRegex);
                                    
                                                    let leftContent = contentToSplit; // Default: all content in left column if separator logic fails
                                                    let rightContent = '';
                                                    let leftRatio = 1;
                                                    let rightRatio = 1;
                                    
                                                    if (separatorMatch) {
                                                        const separatorHTML = separatorMatch[0];
                                                        // The ratio can be in the first capture group (for <p>) or the second (for inline)
                                                        const ratioStr = separatorMatch[1] || separatorMatch[2] || '1:1';
                                                        
                                                        const ratioParts = ratioStr.split(':');
                                                        leftRatio = parseInt(ratioParts[0], 10) || 1;
                                                        rightRatio = parseInt(ratioParts[1], 10) || 1;
                                                        
                                                        // Split content by the full separator
                                                        const parts = contentToSplit.split(separatorHTML);
                                                        leftContent = parts[0] || '';
                                                        rightContent = parts.length > 1 ? parts[1] : '';
                                                    }
                                    
                                                    // Reconstruct the slide content with columns, applying ratios via inline style
                                                    sc.innerHTML = `
                                                        ${titleHTML}
                                                        <div class="columns-container">
                                                            <div class="column-left" style="flex: ${leftRatio};">${leftContent}</div>
                                                            <div class="column-right" style="flex: ${rightRatio};">${rightContent}</div>
                                                        </div>
                                                    `;
                                                }                        slide.appendChild(sc);
                                                // 如果该幻灯片以 <h2> 开头，则在左下方显示所属的 H1 标题
                                                if (currentSlide.length > 0 && currentSlide[0].tagName === "H2" && currentH1Title) {
                                                    var chapterLabel = document.createElement('div');
                                                    chapterLabel.className = "chapter-label";
                                                    chapterLabel.textContent = currentH1Title;
                                                    slide.appendChild(chapterLabel);
                                                }            // presenter notes (if any)
            if (currentPresenterNotes.length > 0) {
                var spn = document.createElement('div');
                spn.className = "slide-presenter-notes";
                for (var j = 0; j < currentPresenterNotes.length; j++) {
                    spn.innerHTML += "<p>" + currentPresenterNotes[j] + "</p>";
                    // TOOD is <p> really correct here?
                }
                slide.appendChild(spn);
            }

            slides.push(slide);
            slideCount++;
            currentSlide = [];
            currentPresenterNotes = [];
            // 如果刚刚遇到新的 H1，则在 slide 完成后更新章节标题
            if (nextH1Title !== null) {
                currentH1Title = nextH1Title;
                nextH1Title = null;
            }
            // if breaking before a heading, add the heading to the upcoming slide
            if (isHeadingSlideBreak(e)) {
                // If a section was pending, it starts with this heading.
                if (nextSectionName) {
                    sections.push({ name: nextSectionName, startSlide: slideCount });
                    nextSectionName = null;
                }
                currentSlide.push(e);
            }
        } else {
            currentSlide.push(e);
        }
    }

    // Add a class to slides that start with an H1 tag for special styling
    for (const slide of slides) {
        const slideContent = slide.querySelector('.slide-content');
        if (!slideContent) continue;

        // Find the first meaningful element, skipping empty paragraphs or text nodes
        let firstMeaningfulElement = null;
        for (const child of slideContent.childNodes) {
            // Check for element nodes that aren't just empty paragraphs from Markdeep
            if (child.nodeType === 1 && (child.tagName !== 'P' || child.textContent.trim() !== '')) {
                firstMeaningfulElement = child;
                break;
            }
        }
        
        if (firstMeaningfulElement && firstMeaningfulElement.tagName === 'H1') {
            slide.classList.add('h1-title-slide');
        }
    }

    // Handle a section marker at the very end of the file
    if (nextSectionName) {
        sections.push({ name: nextSectionName, startSlide: slideCount });
        nextSectionName = null;
    }

    // If no '%%' sections were found, fallback to H1s or H2s
    if (sections.length === 0) {
        // Try H1s first
        for (let i = 0; i < slides.length; i++) {
            const firstContent = slides[i].querySelector('.slide-content > h1');
            if (firstContent) {
                sections.push({ name: firstContent.textContent.trim(), startSlide: i });
            }
        }

        // If still no sections, try H2s
        if (sections.length === 0) {
            for (let i = 0; i < slides.length; i++) {
                const firstContent = slides[i].querySelector('.slide-content > h2');
                if (firstContent) {
                    sections.push({ name: firstContent.textContent.trim(), startSlide: i });
                }
            }
        }
    }

    // Create and insert a Table of Contents slide
    if (sections.length > 0) {
        // 1. Increment counts and section slide numbers
        totalSlideCount++;
        slideCount++;
        for (var s of sections) {
            if (s.startSlide > 0) {
                s.startSlide++;
            }
        }

        // 2. Now that numbers are final, create the TOC slide
        var tocSlide = createTocSlide(totalSlideCount);
        slides.splice(1, 0, tocSlide);

        // 3. Fixup subsequent slide IDs and numbers
        for (var i = 2; i < slides.length; i++) {
            var slide = slides[i];
            slide.id = "slide" + i;

            var sn = slide.querySelector('.slide-number');
            if (sn) {
                sn.innerHTML = `${i}<span class="slide-number-total">/${totalSlideCount}</span>`;
                if (options.totalSlideNumber) {
                    sn.querySelector('.slide-number-total').style.display = 'inline';
                }
            }

            var sp = slide.querySelector('.slide-progress');
            if (sp) {
                sp.setAttribute("style", "width: calc(" + i / (totalSlideCount) + " * var(--slide-width));");
            }
        }
    }

    // Inject CSS for the nav bar
    injectNavBarStyles();

    injectFontSizeButtonStyles();
    addFontSizeButtonsToSlides(slides);

    // Create a nav bar template, then clone and prepend it to each slide
    if (sections.length > 0) {
        var navBarTemplate = createNavBarTemplate();
        for (var i = 0; i < slides.length; i++) {
            var slide = slides[i];
            if (i === 0) continue; // Skip title slide

            var navBar = navBarTemplate.cloneNode(true);
            var sectionIndex = getSectionIndexForSlide(i);

            if (sectionIndex > -1) {
                // Find the actual section span, skipping the TOC button
                navBar.children[sectionIndex + 1].classList.add('active');
            }

            // Add click handlers AFTER cloning
            // First child is TOC button
            navBar.children[0].onclick = function() { gotoSlide(1); return false; };
            // Other children are section links
            for (let j = 0; j < sections.length; j++) {
                let navItem = navBar.children[j + 1];
                let section = sections[j];
                navItem.onclick = function() { gotoSlide(section.startSlide); return false; };
            }

            slide.prepend(navBar);
        }
    }

    // replace .md content with slides
    md.innerHTML = '';
    md.appendChild(document.createElement('div')).id = 'black';
    document.getElementById('black').style.display = 'none';

    for (var j = 0; j < slides.length; j++) {
        var s = slides[j];
        md.appendChild(s);
    }

    // initialize mathjax
    initMathJax();

    // fill in the current date for any elements with the .current-date class
    document.querySelectorAll(".current-date").forEach(e => {
        e.innerText = new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
    });

    // further initialization steps
    processLocationHash();
    addLetterboxing();
    relativizeDiagrams(options.diagramZoom);
    pauseVideos();

    // Convert blockquotes with [!type] syntax into admonitions
    function processAdmonitionBlockquotes() {
        // This regex is designed to match only the first line if it's an admonition marker line.
        var admonitionLineRegex = /(^\s*\[!(\w+)\]\s*(.*)?)(\r\n|\r|\n|$)/;

        document.querySelectorAll('.slide-content blockquote').forEach(function(bq) {
            var markerNode = null;
            
            // Find the first child NODE that looks like it contains the marker at the start.
            for (var i = 0; i < bq.childNodes.length; i++) {
                var node = bq.childNodes[i];
                if (node.textContent && node.textContent.trim().startsWith('[!')) {
                    markerNode = node;
                    break;
                }
            }

            if (!markerNode) return;

            var match = markerNode.textContent.match(admonitionLineRegex);
            if (!match) return; // The node didn't start with the marker line as expected.

            // --- Transformation logic ---
            var fullMatchedLine = match[0]; // The full string that was matched, e.g., "[!warning] title\n"
            var type = match[2] ? match[2].toLowerCase() : 'note';
            var title = match[3] ? match[3].trim() : null;

            var admonitionDiv = document.createElement('div');
            admonitionDiv.className = 'admonition ' + type;

            if (title) {
                var titleDiv = document.createElement('div');
                titleDiv.className = 'admonitionTitle';
                titleDiv.textContent = title;
                admonitionDiv.appendChild(titleDiv);
            }

            // Remove only the matched line from the beginning of the text node's content
            markerNode.textContent = markerNode.textContent.substring(fullMatchedLine.length);
            
            // If the markerNode is now empty (e.g., it only contained the marker), remove it completely.
            if (markerNode.textContent.trim() === '') {
                markerNode.remove();
            }

            // Move remaining content from the blockquote to the new div
            while (bq.firstChild) {
                admonitionDiv.appendChild(bq.firstChild);
            }

            // Replace the blockquote with the new admonition div
            bq.parentNode.replaceChild(admonitionDiv, bq);
        });
    }
    processAdmonitionBlockquotes();

    fullscreenActions();
};

function injectNavBarStyles() {
    var style = document.createElement('style');
    style.textContent = `
        .top-nav-bar {
            background: rgba(255, 255, 255, 0.9);
            text-align: center;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: center;
            gap: 20px;
            font-size: 18px;
            width: 100%;
        }
        .nav-section-item {
            cursor: pointer;
            color: #333;
            transition: color 0.3s;
        }
        .nav-section-item.active {
            color: red;
            font-weight: bold;
        }
        .toc-button {
            margin-right: 1em;
            border-right: 1px solid #ccc;
            padding-right: 1em;
        }
        .toc-title {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 0.5em;
            text-align: center;
        }
        .toc-list {
            text-align: left;
            margin: 0 auto;
            width: 90%;
            height: 75%;
            overflow: hidden;
            column-width: 18em;
            column-gap: 2em;
        }
        .toc-list li {
            margin-bottom: 0.5em;
        }
    `;
    document.head.appendChild(style);
}

function createNavBarTemplate() {
    var navBar = document.createElement('div');
    navBar.className = 'top-nav-bar';

    // Add TOC button
    var tocButton = document.createElement('span');
    tocButton.className = 'nav-section-item toc-button';
    tocButton.textContent = '目录';
    navBar.appendChild(tocButton);

    sections.forEach((section, index) => {
        let item = document.createElement('span');
        item.className = 'nav-section-item';
        item.textContent = section.name;
        item.dataset.sectionIndex = index;
        navBar.appendChild(item);
    });
    return navBar;
}

function getSectionIndexForSlide(slideNum) {
    let currentSectionIndex = -1;
    for (let i = 0; i < sections.length; i++) {
        if (slideNum >= sections[i].startSlide) {
            currentSectionIndex = i;
        } else {
            break;
        }
    }
    return currentSectionIndex;
}

function createTocSlide(totalSlideCount) {
    var slide = document.createElement('div');
    slide.className = "slide";
    slide.id = "slide1"; // It will be slide 1

    var sc = document.createElement('div');
    sc.className = "slide-content";
    
    var title = document.createElement('div'); // Changed from h1 to div
    title.className = "toc-title"; // Added class for styling
    title.textContent = "目录";
    sc.appendChild(title);

    var list = document.createElement('ul');
    list.className = "toc-list"; // Use class for styling

    for (var section of sections) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.textContent = section.name;
        link.href = "#";
        // Use a closure to capture the correct, final startSlide value
        (function(s) {
            link.onclick = function() { gotoSlide(s.startSlide); return false; };
        })(section);
        item.appendChild(link);
        list.appendChild(item);
    }
    sc.appendChild(list);
    slide.appendChild(sc);

    // Also need to add slide number and progress bar for consistency
    var sn = document.createElement('div');
    sn.className = "slide-number";
    sn.innerHTML = `1<span class="slide-number-total">/${totalSlideCount}</span>`;
    slide.appendChild(sn);

    // Ensure total slide number is visible if option is set
    if (options.totalSlideNumber) {
        sn.querySelector('.slide-number-total').style.display = 'inline';
    }

    var sp = document.createElement('div');
    sp.className = "slide-progress";
    sp.setAttribute("style", "width: calc(1 / " + totalSlideCount + " * var(--slide-width));");
    slide.appendChild(sp);

    return slide;
}


// override default options with any differing user-specified options
function processMarkdeepSlidesOptions() {
    options = {
        aspectRatio: 16 / 9,
        theme: 'simple',
        fontSize: 28,
        diagramZoom: 1.0,
        totalSlideNumber: false,
        progressBar: true,
        breakOnHeadings: false,
        incremental: false,
        incrementalFlat: false, // Use camelCase for consistency
        slideChangeHook: (oldSlide, newSlide) => {},
        modeChangeHook: (newMode) => {}
    };

    if (typeof markdeepSlidesOptions !== 'undefined') {
        options = Object.assign({}, options, markdeepSlidesOptions);
    }
}

// initialize mathjax
function initMathJax() {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "markdeep-slides/lib/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_SVG"; //这里使用相对路径2511151223
    document.getElementsByTagName("head")[0].appendChild(script);
}

// check if a slide is set via the location hash – if so, load it, else
// write the first slide to it. either way, go to that slide
function processLocationHash() {
    var slideNum;
    if (window.location.hash) {
        var slide = window.location.hash.substring(1);
        var slideNum = parseInt(slide.substring(5), 10);

        // clamp slide number to maximum existing slide number (can be an issue
        // when deleting slides while at the very bottom of the page in draft
        // mode and then refreshing)
        if (slideNum > slideCount - 1) {
            slideNum = slideCount - 1;
            history.replaceState({}, '', '#' + "slide" + slideNum);
        }
    } else {
        var slideNum = 0;
    }
    showSlide(slideNum);
}

// depending on whether your viewport is wider or taller than the aspect ratio
// of your slides, add a corresponding class to the root <html> element. based
// on this, in presentation mode, letterboxing is added to keep your slides
// centered on a non-matching screen. until max() (or min(), or clamp()) is
// available in css, this bit of javascript is required. :(
function addLetterboxing() {
    var aspectRatio = eval(getComputedStyle(document.documentElement).getPropertyValue('--aspect-ratio'));

    var w = window.innerWidth;
    var h = window.innerHeight;

    var viewportAspectRatio = w / h;

    var root = document.documentElement;
    if (viewportAspectRatio > aspectRatio) {
        root.classList.remove('taller');
        root.classList.remove('wider'); // no frickin idea why this is necessary to keep font sizes updated... browser bug?
        root.classList.add('wider');
    } else {
        root.classList.remove('wider');
        root.classList.remove('taller');
        root.classList.add('taller');
    }
}
window.addEventListener('resize', addLetterboxing);

// make diagrams resize properly: markdeep diagrams have their width and
// height attributes set to absoulute pixel values, which don't scale. so we
// need to move this width and height information into a new viewbox
// attribute, then we can set a relative width and height in css based on
// baseRem defined below, which would be the rem if the document was 640px
// wide (just to have a baseline value independent of window size on load;
// this also matches width in print mode, which doesn't bring any advantages
// but whatever)
function relativizeDiagrams(diagramZoom) {
    var baseRem = 17.92;
    //var baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) * (640 / window.innerWidth);  // doesn't work in some browsers because the font size hasn't yet been set correctly when this function is executed

    // this factor works well as a baseline
    var zoom = 0.9 * diagramZoom;

    document.querySelectorAll("svg.diagram").forEach(function(diag) {
        function toRem(px) {
            return (parseFloat(px) / baseRem) + "rem";
        }

        var w = diag.getAttribute("width"),
            h = diag.getAttribute("height");

        diag.removeAttribute("width");
        diag.removeAttribute("height");
        diag.setAttribute("viewBox", "0 0 " + w + " " + h);
        diag.style.width  = toRem(w * zoom);
        diag.style.height = toRem(h * zoom);

        if (diag.style.marginTop) {
            diag.style.marginTop = toRem(diag.style.marginTop);
        }
        if (diag.style.marginRight) {
            diag.style.marginRight = toRem(diag.style.marginRight);
        }
        if (diag.style.marginBottom) {
            diag.style.marginBottom = toRem(diag.style.marginBottom);
        }
        if (diag.style.marginLeft) {
            diag.style.marginLeft = toRem(diag.style.marginLeft);
        }
    });
}

// pause all videos and store their "autoplay" attribute for later
function pauseVideos() {
    Array.from(document.getElementsByTagName("video")).forEach(function (video) {
        if (!video.hasAttribute("data-autoplay")) {
            video.setAttribute("data-autoplay", video.autoplay);
        }
        video.preload = "auto";  // preload video, if possible
        video.autoplay = false;  // set autoplay to false
        video.load();            // reload it to reset position to zero
    });
}

// play videos of the current slides which have been designated as "autoplay"
function playAutoplayingVideos(slideNum) {
    var slide = document.getElementById("slide" + slideNum);
    Array.from(slide.getElementsByTagName("video")).forEach(function (video) {
        video.autoplay = video.getAttribute("data-autoplay");
        if (video.autoplay) {
            video.play();
        }
    });
}

// some browsers (lookin' at you, safari) may fire scroll events as they're
// leaving fullscreen. this makes it impossible to switch to the current slide
// when coming out of presentation mode before updateOnScroll() resets the
// location hash to the value it was before entering fullscreen. so we need to
// ignore scroll events for a short amount of time after leaving fullscreen mode
var enableScroll = true;

// when scrolling, update location hash (and presenter notes etc.) based on
// which slide is visible right now. only makes sense in draft mode
function updateOnScroll() {
    if (!enableScroll || document.documentElement.classList.contains("presentation")) {
        return;
    }

    var slides = document.getElementsByClassName("slide");
    var bestSlideNum = 0;
    var maxVisibility = 0;
    var viewportHeight = window.innerHeight;

    for (var i = 0; i < slides.length; i++) {
        var slide = slides[i];
        var bcr = slide.getBoundingClientRect();
        
        var visibleTop = Math.max(0, bcr.top);
        var visibleBottom = Math.min(viewportHeight, bcr.bottom);
        var visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > maxVisibility) {
            maxVisibility = visibleHeight;
            bestSlideNum = parseInt(slide.id.substring(5), 10);
        }
    }

    // update things only when the slide changes to improve performance
    if (bestSlideNum != currentSlideNum) {
        history.replaceState({}, '', '#' + "slide" + bestSlideNum);
        options.slideChangeHook(currentSlideNum, bestSlideNum);
        currentSlideNum = bestSlideNum;
        updatePresenterNotes(bestSlideNum);
    }
}
window.addEventListener('scroll', updateOnScroll);

// switch to slide n
function showSlide(slideNum) {
    if (document.documentElement.classList.contains("draft")) {

        // set all slides to visible (in case presentation mode was previously active)
        Array.from(document.getElementsByClassName("slide")).map(e => e.style.display = "inline-block");

        // fix for chrome sometimes mistiming scroll events (or at least that's what I think is going on)
        enableScroll = false;
        document.getElementById("slide" + slideNum).scrollIntoView();
        setTimeout(function () {
            enableScroll = true;
        }, 10);
    } else if (document.documentElement.classList.contains("presentation")) {

        // hide all slides except for the one to be shown
        Array.from(document.getElementsByClassName("slide")).map(e => e.style.display = "none");
        document.getElementById("slide" + slideNum).style.display = "inline-block";

        // pause vidoes on other slides and start playing autoplay videos on the current slide
        pauseVideos();
        playAutoplayingVideos(slideNum);
    }

    history.replaceState({}, '', '#' + "slide" + slideNum);
    options.slideChangeHook(currentSlideNum, slideNum);
    currentSlideNum = slideNum;
    
    // Discover and reset build items for the new slide
    var currentSlideEl = document.getElementById("slide" + currentSlideNum);
    buildItems = []; // Reset builds

    if (currentSlideEl) {
        var slideContent = currentSlideEl.querySelector('.slide-content');
        if (slideContent && slideContent.classList.contains('build')) {
            // New [build] mode logic
            var topLevelElements = Array.from(slideContent.children);
            topLevelElements.forEach(function(el) {
                // Do not make the nav bar a build step
                if (el.classList.contains('top-nav-bar')) return;

                if (el.tagName === 'UL' || el.tagName === 'OL') {
                    // For lists, each list item is a step
                    var listItems = Array.from(el.querySelectorAll('li'));
                    buildItems = buildItems.concat(listItems);
                } else {
                    // For other elements, the element itself is a step
                    buildItems.push(el);
                }
            });

        } else {
            // Logic for manual builds (:::appear, :::incremental), now with ordering
            var defaultBuilds = [];
            var numberedBuilds = []; // Array of { item: el, order: num }
    
            // 1. Gather incremental list items as default builds
            var incrementalBlock = currentSlideEl.querySelector(".incremental");
            var incrementalFlatBlock = currentSlideEl.querySelector(".incremental-flat");
            var isNotInAppearBlock = function(element) { return !element.closest('[class^="appear"]'); };
    
            if (incrementalBlock) {
                var listItems = Array.from(incrementalBlock.querySelectorAll("li"));
                defaultBuilds = defaultBuilds.concat(listItems.filter(isNotInAppearBlock));
            } else if (incrementalFlatBlock) {
                var listItems = Array.from(incrementalFlatBlock.querySelectorAll(":scope > ul > li, :scope > ol > li"));
                defaultBuilds = defaultBuilds.concat(listItems.filter(isNotInAppearBlock));
            }
            
            // 2. Gather all 'appear' blocks and sort them into default or numbered
            var appearBlocks = currentSlideEl.querySelectorAll('[class^="appear"]');
            var orderRegex = /appear(\d+)/;
    
            appearBlocks.forEach(function(block) {
                var match = block.className.match(orderRegex);
                if (match) {
                    var order = parseInt(match[1], 10);
                    numberedBuilds.push({ item: block, order: order });
                } else {
                    defaultBuilds.push(block);
                }
            });
    
            // 3. Sort numbered builds
            numberedBuilds.sort(function(a, b) { return a.order - b.order; });
    
            // 4. Concatenate everything: default builds first, then sorted numbered builds
            buildItems = defaultBuilds.concat(numberedBuilds.map(function(b) { return b.item; }));
        }

        // Reset visibility on all collected build items
        if (buildItems.length > 0) {
          buildItems.forEach(function(item) {
              item.classList.remove('visible');
          });
        }
    }
    currentBuildStep = 0;

    updatePresenterNotes(slideNum);
}

// load presenter notes for slide n into presenter notes window
function updatePresenterNotes(slideNum) {
    if (presenterNotesWindow) {
        var presenterNotesElement = document.getElementById("slide" + slideNum).querySelector(".slide-presenter-notes");
        var presenterNotes = "";
        if (presenterNotesElement) {
            presenterNotes = presenterNotesElement.innerHTML;
        }

        presenterNotesWindow.document.getElementById("slide-number").innerHTML = `<span class="current">${slideNum}</span><span class="total">/${slideCount - 1}</span>`;
        presenterNotesWindow.document.getElementById("presenter-notes").innerHTML = presenterNotes;
    }
}

// ->
function nextSlide() {
    // If there are build items and not all are visible yet
    if (buildItems.length > 0 && currentBuildStep < buildItems.length) {
        buildItems[currentBuildStep].classList.add('visible');
        currentBuildStep++;
        return;
    }

    // Otherwise, go to the next slide
    if (currentSlideNum < slideCount - 1) {
        showSlide(currentSlideNum + 1);
    }
}

// <-
function prevSlide() {
    // If there are build items and some are visible
    if (buildItems.length > 0 && currentBuildStep > 0) {
        currentBuildStep--;
        buildItems[currentBuildStep].classList.remove('visible');
        return;
    }

    // Otherwise, go to the previous slide
    if (currentSlideNum > 0) {
        showSlide(currentSlideNum - 1);
    }
}

// goto
function gotoSlide(slideNum) {
    if (0 <= slideNum && slideNum <= slideCount - 1) {
        showSlide(slideNum);
    }
}

// my best shot at a works-everywhere "fullscreen?" predicate, which will
// invariably break in the future. web development is great!
function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement ||
              window.fullScreen /*||
              (window.innerHeight == screen.height && window.innerWidth == screen.width)*/);
}

// toggles fullscreen mode, upon which the fullscreenchange event is fired
// (which is *also* fired when a user leaves fullscreen via the Esc key, so we
// can't just ignore it), so there's no need to call fullscreenActions()
// directly in here
function toggleFullscreen() {
    var fullscreen = isFullscreen();

    if (fullscreen) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    } else {
        var root = document.documentElement;
        if (root.requestFullscreen) {
            root.requestFullscreen();
        } else if (root.mozRequestFullScreen) {
            root.mozRequestFullScreen();
        } else if (root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
        } else if (root.msRequestFullscreen) {
            root.msRequestFullscreen();
        }
    }
}

function injectFontSizeButtonStyles() {
    var style = document.createElement('style');
    style.textContent = `
        .slide {
            position: relative; /* Needed for absolute positioning of buttons */
        }
        .fontsize-buttons {
            position: absolute;
            top: 15px;
            right: 15px;
            z-index: 1000;
            display: flex;
            gap: 8px;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
        }
        .slide:hover .fontsize-buttons {
            opacity: 1;
        }
        .fontsize-buttons button {
            padding: 2px 8px;
            font-size: 14px;
            background-color: #eee;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
        }
        .fontsize-buttons button:hover {
            background-color: #ddd;
        }
    `;
    document.head.appendChild(style);
}

function addFontSizeButtonsToSlides(slides) {
    var buttonContainerTemplate = document.createElement('div');
    buttonContainerTemplate.className = 'fontsize-buttons';

    var smallButton = document.createElement('button');
    smallButton.textContent = '○';
    smallButton.title = '缩小字体';
    var smallButtonOnClick = function() {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('tiny-text');
            slide.classList.add('small-text');
        }
    };

    var tinyButton = document.createElement('button');
    tinyButton.textContent = '-';
    tinyButton.title = '进一步缩小字体';
    var tinyButtonOnClick = function() {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('small-text');
            slide.classList.add('tiny-text');
        }
    };
    
    var resetButton = document.createElement('button');
    resetButton.textContent = '+';
    resetButton.title = '恢复正常字体';
    var resetButtonOnClick = function() {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('small-text');
            slide.classList.remove('tiny-text');
        }
    };

    buttonContainerTemplate.appendChild(resetButton);
    buttonContainerTemplate.appendChild(smallButton);
    buttonContainerTemplate.appendChild(tinyButton);

    for (var i = 1; i < slides.length; i++) { // Start from 1 to skip title slide
        var slide = slides[i];
        var buttons = buttonContainerTemplate.cloneNode(true);
        // Re-attach event listeners after cloning
        buttons.children[0].onclick = resetButtonOnClick;
        buttons.children[1].onclick = smallButtonOnClick;
        buttons.children[2].onclick = tinyButtonOnClick;
        slide.appendChild(buttons);
    }
}

function fullscreenActions() {
    enableScroll = false;

    var fullscreen = isFullscreen();
    options.modeChangeHook(fullscreen? "presentation" : "draft");

    var root = document.documentElement;
    if (fullscreen) {
        root.classList.remove("draft");
        root.classList.add("presentation");
    } else {
        root.classList.remove("presentation");
        root.classList.add("draft");
    }

    // allow some time for getting into or out of fullscreen
    setTimeout(function () {
        showSlide(currentSlideNum);
        enableScroll = true;
    }, 100);
}
document.addEventListener("fullscreenchange", fullscreenActions);
document.addEventListener("mozfullscreenchange", fullscreenActions);
document.addEventListener("webkitfullscreenchange", fullscreenActions);
document.addEventListener("msfullscreenchange", fullscreenActions);

// turn the screen black or back again
function toggleBlack() {
    var black = document.getElementById("black");
    if (black.style.display == "none") {
        black.style.display = "block";
    } else {
        black.style.display = "none";
    }
}

// open or close presenter notes window
function togglePresenterNotes() {
    if (presenterNotesWindow && !presenterNotesWindow.closed) {
        presenterNotesWindow.close();
        presenterNotesWindow = null;
        return;
    }

    presenterNotesStyles = '<link rel="stylesheet" href="markdeep-slides/markdeep-slides.css">';
    if (/[/.]+/.test(options.theme)) {
        presenterNotesStyles += '<link rel="stylesheet" href="' + options.theme + '">';
    } else {
        presenterNotesStyles += '<link rel="stylesheet" href="markdeep-slides/themes/' + options.theme + '.css">';
    }

    presenterNotesWindow = window.open("", "presenternotes", "");
    if (presenterNotesWindow) {
        with (presenterNotesWindow.document) {
            open("text/html", "replace");
            write(`
<html class="presenter-notes">
<head>
    <title>Presenter Notes</title>
    ${presenterNotesStyles}
</head>
<body>
    <div class="presenter-notes-meta">
        <div id="timer"></div>
        <div id="clock"></div>
        <div id="slide-number"><span class="current">${currentSlideNum}</span><span class="total">/${slideCount - 1}</span></div>
        &nbsp;
    </div>
    <div class="presenter-notes-notes" id="presenter-notes"></div>
    <script>

        // forward key presses to parent window
        document.body.onkeydown = function(event) {
            opener.keyPress(event);
        };

        // update clock once a second
        function updateClock() {
            var time = new Date();
            time = ('0' + time.getHours()).slice(-2)   + ':' +
                   ('0' + time.getMinutes()).slice(-2) + '<span class="seconds">:' +
                   ('0' + time.getSeconds()).slice(-2) + '</span>';
            document.getElementById('clock').innerHTML = time;
        }
        updateClock();
        setInterval(updateClock, 1000);

        // update timer once a second if it's running, hide it if it's not
        // running anymore
        function updateTimer() {
            if (opener.presenterNotesTimerStart) {
                var time = Math.abs(new Date() - opener.presenterNotesTimerStart);

                var minutes = Math.floor(time / 60000);
                var seconds = ((time % 60000) / 1000).toFixed(0);

                time = ('0' + minutes).slice(-2) + '<span class="seconds">:' +
                       ('0' + seconds).slice(-2) + '</span>';

                document.getElementById('timer').innerHTML = time;
            } else {
                document.getElementById('timer').innerHTML = "";
            }
        }
        updateTimer();
        setInterval(updateTimer, 1000);
    </script>
</body>
</html>`);
            close();
        }
    }

    // load presenter notes for the current slide
    updatePresenterNotes(currentSlideNum);
}

function resetPresenterNotesTimer() {
    if (window.presenterNotesTimerStart) {
        window.presenterNotesTimerStart = null;
    } else {
        window.presenterNotesTimerStart = new Date();
    }

    // apply reset immediately if presenter notes window is open
    if (presenterNotesWindow && !presenterNotesWindow.closed) {
        presenterNotesWindow.updateTimer();
    }
}


// keyboard/presenter controls (these map well to my logitech r400
// presenter, others may vary)
var gotoSlideNum = [];
function keyPress(event) {

    // ignore if the user is editing text (nothing of the sort is available in
    // stock markdeep-slides, but the user might include interactive elements,
    // which markdeep-slides should work with seamlessly)
    if (document.activeElement.isContentEditable || document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA") {
        return
    }

    // ignore if any meta keys have been pressed as well
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    switch (event.keyCode) {
      case 39:  // left
      case 40:  // down
      case 32:  // space
      case 34:  // pgdn
        nextSlide();
        return false;
      case 37:  // right
      case 38:  // up
      case 33:  // pgup
        prevSlide();
        return false;
      case 27:  // escape
      case 116: // f5
      case 70:  // f
        toggleFullscreen();
        return false;
      case 190: // .
        toggleBlack();
        return false;
      case 78:  // n
        togglePresenterNotes();
        return false;
      case 84:  // t
        resetPresenterNotesTimer();
        return false;
      case 48:  // 0
      case 49:  // 1
      case 50:  // 2
      case 51:  // 3
      case 52:  // 4
      case 53:  // 5
      case 54:  // 6
      case 55:  // 7
      case 56:  // 8
      case 57:  // 9
        gotoSlideNum.push(event.keyCode - 48);
        return false;
      case 8:  // backspace
        gotoSlideNum.pop();
        return false;
      case 13:  // enter
        if (gotoSlideNum.length == 0) {
            return false;
        }

        // convert list of digits "gotoSlideNum" into number "slide"
        var slide = 0;
        var i = 0;
        for (let n of gotoSlideNum.reverse()) {
            slide += n * (10 ** i++);
        }
        gotoSlideNum = [];

        gotoSlide(slide);
        return false;
      default:
        return;
    }
};
document.body.onkeydown = keyPress;

// set --vw and --vw css variables to viewport size, EXCLUDING the scroll bars
// (the css units vw and vh include them, which is less than ideal), in order to
// fix #23. ideally, this would run whenever the following events are fired:
// * load
// * resize
// * fullscreenchange
// but that doesn't seem to suffice in all cases and all browsers, so we sadly
// need to run it a couple times a second (this works perceptually instantly
// without slowing everything down too much)
function setCssViewport() {
    var cw = document.body.clientWidth;
    document.documentElement.style.setProperty('--vw', cw / 100 + 'px');
    var ch = document.body.clientHeight;
    document.documentElement.style.setProperty('--vh', ch / 100 + 'px');
}
document.addEventListener("load", setCssViewport);
document.addEventListener("resize", setCssViewport);
document.addEventListener("fullscreenchange", setCssViewport);
document.addEventListener("mozfullscreenchange", fullscreenActions);
document.addEventListener("webkitfullscreenchange", fullscreenActions);
document.addEventListener("msfullscreenchange", fullscreenActions);
setInterval(setCssViewport, 200);

// make cursor disappear after two seconds in presentation mode
var cursorTimeout;
document.body.onmousemove = function() {
    if (document.body.style.cursor != "none") {
        if (cursorTimeout) {
            clearTimeout(cursorTimeout);
        }
    } else {
        document.body.style.cursor = "auto";
    }

    cursorTimeout = setTimeout(function() {
        if (document.documentElement.classList.contains("draft")) {
            return;
        }

        document.body.style.cursor = "none";
    }, 2000);
};