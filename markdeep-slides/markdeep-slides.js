function _captureMarkdeepRawSourceFromBody() {
    if (!document.body) return '';

    var chunks = [];
    for (var i = 0; i < document.body.childNodes.length; i++) {
        var node = document.body.childNodes[i];
        if (node.nodeType === 3) {
            // Text nodes: textContent already gives decoded characters.
            chunks.push(node.textContent || '');
        } else if (node.nodeType === 8) {
            chunks.push('<!--' + node.nodeValue + '-->');
        } else {
            var tag = (node.tagName || '').toLowerCase();
            if (tag === 'script' || tag === 'style') {
                // outerHTML of script/style serialises ">" inside the content as "&gt;"
                // in some browsers (e.g. older Safari). Rebuild the tag manually so
                // the raw ">" characters are preserved.
                var attrs = '';
                for (var j = 0; j < node.attributes.length; j++) {
                    var a = node.attributes[j];
                    attrs += ' ' + a.name + '="' + a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
                }
                chunks.push('<' + tag + attrs + '>' + node.textContent + '</' + tag + '>');
            } else {
                chunks.push(node.outerHTML || node.textContent || '');
            }
        }
    }
    // outerHTML serialisation in some browsers encodes ">" as "&gt;" inside
    // element text content. Decode it back so the editing window always shows
    // the same characters as the raw file.  Order matters: &amp; must come last
    // so we don't double-decode "&amp;gt;" → "&gt;" → ">".
    return chunks.join('')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

// Intercept markdeepOptions assignment to enforce smartQuotes:false.
// Markdeep's smart-quote logic maps " to « for French/Spanish/Catalan but fails
// to convert the closing " (language table uses &rtquo; while the code looks up
// &rdquo;), producing broken output like «word". Disabling it unconditionally is
// safe for presentations where authors control their own typography.
(function () {
    var _stored = {};
    Object.defineProperty(window, 'markdeepOptions', {
        configurable: true,
        get: function () { return _stored; },
        set: function (val) { _stored = Object.assign({}, val, { smartQuotes: false }); }
    });
})();

if (!window._markdeepRawSource && document.body) {
    var _capturedMarkdeepRawSource = _captureMarkdeepRawSourceFromBody();
    if (_capturedMarkdeepRawSource.trim()) {
        window._markdeepRawSource = _capturedMarkdeepRawSource;
    }
}

(function preprocessChartFences() {
    var CHART_TYPES = ['mermaid', 'echarts', 'chartjs', 'chart\\.js', 'd3-force', 'd3-network', 'svg'];
    var pattern = new RegExp('```(' + CHART_TYPES.join('|') + ')\\b([^\\n]*)', 'gi');

    function walk(node) {
        if (node.nodeType === 3) {
            var text = node.textContent;
            var replaced = text.replace(pattern, function (_, type, rest) {
                var result = '```\nchart: ' + type.toLowerCase();
                var heightMatch = rest.trim().match(/height\s*:\s*(.+)/i);
                if (heightMatch) result += '\nheight: ' + heightMatch[1].trim();
                return result;
            });
            if (replaced !== text) node.textContent = replaced;
        } else {
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        }
    }

    if (document.body) walk(document.body);
}());

// Ensure a blank `>` line exists between a callout marker line and the first
// content line so Markdeep always creates two separate blockquote paragraphs.
// Matches:  > [!type] Title\n> content
// Inserts:  > [!type] Title\n>\n> content
(function preprocessCalloutBlankLines() {
    var pattern = /([ \t]*>[ \t]*\[!\w+\][^\n]*)(\r?\n)([ \t]*>[ \t]*\S)/g;

    function walk(node) {
        if (node.nodeType === 3) {
            var text = node.textContent;
            var replaced = text.replace(pattern, '$1$2>$2$3');
            if (replaced !== text) node.textContent = replaced;
        } else if (node.nodeType === 1) {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        }
    }

    if (document.body) walk(document.body);
}());

// Markdeep requires a blank `>` line at the very start of each blockquote block;
// without it a single-line blockquote is not rendered at all.
// Insert `>` before any `>` content line whose preceding line is not itself a `>` line.
(function preprocessBlockquoteBlankLines() {
    function processText(text) {
        var lines = text.split('\n');
        var result = [];
        var fenceDepth = 0;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Track code/fence blocks so we leave their content untouched.
            if (/^[ \t]*(```|~~~|:{3,})/.test(line)) {
                fenceDepth = fenceDepth > 0 ? 0 : 1;
            }

            if (fenceDepth === 0 && /^[ \t]*>/.test(line)) {
                var prevLine = result.length > 0 ? result[result.length - 1] : '';
                if (!/^[ \t]*>/.test(prevLine)) {
                    // Insert a blank `>` to open the blockquote block.
                    result.push('>');
                }
            }

            result.push(line);
        }

        return result.join('\n');
    }

    function walk(node) {
        if (node.nodeType === 3) {
            var text = node.textContent;
            var replaced = processText(text);
            if (replaced !== text) node.textContent = replaced;
        } else if (node.nodeType === 1) {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        }
    }

    if (document.body) walk(document.body);
}());

// Ensure a blank line exists between a fence opening marker and its first content line.
// Without it Markdeep treats the content (e.g. a list) as a continuation paragraph.
// Pattern: :::blocktype immediately followed (no blank line) by a non-empty line.
(function preprocessFenceBlankLines() {
    var pattern = /(:{3,}[a-zA-Z][^\n]*)(\r?\n)(?=[^\r\n])/g;

    function walk(node) {
        if (node.nodeType === 3) {
            var text = node.textContent;
            var replaced = text.replace(pattern, '$1$2$2');
            if (replaced !== text) node.textContent = replaced;
        } else if (node.nodeType === 1) {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        }
    }

    if (document.body) walk(document.body);
}());

(function preprocessPlusLists() {
    function processText(text) {
        if (!/^\+ /m.test(text)) return text;

        var lines = text.split('\n');
        var result = [];
        var inPlusGroup = false;
        var inCodeFence = false;
        var codeFenceChar = '';

        function endGroup(nextLine) {
            result.push('');       // blank line so Markdeep ends the list before :::
            result.push(':::');
            inPlusGroup = false;
            result.push(nextLine);
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            if (!inCodeFence) {
                var fenceOpen = line.match(/^(`{3,}|~{3,})/);
                if (fenceOpen) {
                    inCodeFence = true;
                    codeFenceChar = fenceOpen[1][0];
                    if (inPlusGroup) endGroup(line);
                    else result.push(line);
                    continue;
                }
            } else {
                if (new RegExp('^\\' + codeFenceChar + '{3,}\\s*$').test(line)) {
                    inCodeFence = false;
                    codeFenceChar = '';
                }
                result.push(line);
                continue;
            }

            if (!inPlusGroup) {
                if (/^\+ /.test(line)) {
                    result.push(':::incremental');
                    result.push('');   // blank line so Markdeep recognises the following - as a list
                    inPlusGroup = true;
                    result.push('- ' + line.slice(2));
                } else {
                    result.push(line);
                }
            } else {
                if (/^\+ /.test(line)) {
                    result.push('- ' + line.slice(2));
                } else if (/^[ \t]/.test(line)) {
                    result.push(line.replace(/^([ \t]*)\+ /, '$1- '));
                } else {
                    endGroup(line);
                }
            }
        }

        if (inPlusGroup) {
            result.push('');
            result.push(':::');
        }

        return result.join('\n');
    }

    function walk(node) {
        if (node.nodeType === 3) {
            var text = node.textContent;
            var replaced = processText(text);
            if (replaced !== text) node.textContent = replaced;
        } else if (node.nodeType === 1) {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'SCRIPT' || tag === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        }
    }

    if (document.body) walk(document.body);
}());

var currentSlideNum = 0;
var slideCount = 0;

// Additions for top nav bar
var sections = [];

// make presenter notes window modifiable globally
var presenterNotesWindow;

// "window." makes this variable available to the presenter notes window
window.presenterNotesTimerStart = null;

var slideChangeHook = (oldSlide, newSlide) => { };
var modeChangeHook = (newMode) => { };

// state for incremental builds
var buildItems = [];
var currentBuildStep = 0;

// Overview zoom: number of card columns per row (2–10)
var overviewColumns = 4;

// Overview pinch-to-zoom state (transform on .md, not CSS zoom on body)
// Using transform avoids flex reflow — layout stays fixed, content may go "out of bounds"
var ovPinchScale = 1.0;
var ovPinchTx    = 0;   // cumulative X translation (px) to keep cursor point fixed
var ovPinchTy    = 0;

// make options available globally
var options;

function getNumberedSlideCount(totalSlideCount) {
    return Math.max(totalSlideCount - 1, 0);
}

function buildSlideNumberMarkup(displaySlideNumber, totalSlideCount) {
    return `${displaySlideNumber}<span class="slide-number-total">/${getNumberedSlideCount(totalSlideCount)}</span>`;
}

function buildSlideProgressStyle(displaySlideNumber, totalSlideCount) {
    var numberedSlideCount = getNumberedSlideCount(totalSlideCount);
    if (numberedSlideCount <= 0) {
        return "width: 0;";
    }

    return "width: calc(" + displaySlideNumber / numberedSlideCount + " * var(--slide-width));";
}

function processFencedBlocks(nodes) {
    var newNodes = [];
    // Stack to track nested fences, each entry has: { colonCount, blockType, blockOptions, capturedNodes }
    var fenceStack = [];

    // Dynamic regex pattern that matches 3 or more colons followed by a block type
    // Captures: (1) colons, (2) block type, (3) optional ratio
    var startFenceRegex = /^(:{3,})(incremental|incremental-flat|appear\d*|big|small|tiny|columns)(?:\s+([0-9]+(?::[0-9]+)*))?\s*$/;
    // Dynamic regex for end fence - captures just the colons
    var endFenceRegex = /^(:{3,})\s*$/;

    // Pre-process nodes: split text nodes that contain multiple fence markers on different lines
    var preprocessedNodes = [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var text = node.textContent ? node.textContent : '';

        // Check if this node contains multiple lines with fence patterns
        if (text.indexOf('\n') !== -1) {
            var lines = text.split('\n');
            var hasFenceMarker = false;

            for (var j = 0; j < lines.length; j++) {
                var line = lines[j].trim();
                if (line.match(startFenceRegex) || line.match(endFenceRegex)) {
                    hasFenceMarker = true;
                    break;
                }
            }

            // If there are fence markers within multi-line content, split into separate text nodes
            if (hasFenceMarker) {
                for (var j = 0; j < lines.length; j++) {
                    var line = lines[j];
                    if (line.trim()) {  // Only add non-empty lines
                        var textNode = document.createTextNode(line);
                        preprocessedNodes.push(textNode);
                    }
                }
                continue;
            }
        }
        preprocessedNodes.push(node);
    }

    for (var i = 0; i < preprocessedNodes.length; i++) {
        var node = preprocessedNodes[i];
        // Ensure node has textContent property before trimming
        var text = node.textContent ? node.textContent.trim() : '';

        // Check for fence start pattern
        var startMatch = text.match(startFenceRegex);

        if (startMatch) {
            var colonCount = startMatch[1].length;
            var blockType = startMatch[2];
            var blockOptions = {};

            if (blockType === 'columns' && startMatch[3]) {
                blockOptions.flexValues = startMatch[3].split(':').map(function(v) {
                    return parseInt(v, 10) || 1;
                });
            }

            fenceStack.push({
                colonCount: colonCount,
                blockType: blockType,
                blockOptions: blockOptions,
                capturedNodes: []
            });
            continue;
        }

        // Check for fence end pattern
        var endMatch = text.match(endFenceRegex);

        if (endMatch && fenceStack.length > 0) {
            var endColonCount = endMatch[1].length;
            var currentFence = fenceStack[fenceStack.length - 1];

            // Check if the end fence colon count matches the current fence's colon count
            if (endColonCount === currentFence.colonCount) {

                // Pop this fence from the stack
                fenceStack.pop();

                // Create wrapper element for this block
                var wrapper = document.createElement('div');
                wrapper.className = currentFence.blockType;

                if (currentFence.blockType === 'columns') {
                    var processedInnerNodes = processFencedBlocks(currentFence.capturedNodes);
                    var content = '';
                    for (var j = 0; j < processedInnerNodes.length; j++) {
                        var childNode = processedInnerNodes[j];
                        if (childNode.nodeType === 3) {
                            content += childNode.textContent;
                        } else {
                            content += childNode.outerHTML || childNode.textContent;
                        }
                    }

                    // Normalize both paragraph-wrapped and raw ;;;;;; separators
                    var normalized = content.replace(/<p>\s*;;;;;;\s*<\/p>|;;;;;;\s*/g, '\x00SPLIT\x00');
                    var parts = normalized.split('\x00SPLIT\x00')
                        .map(function(p) { return p.trim(); })
                        .filter(function(p) { return p.length > 0; });

                    var numParts = parts.length;
                    var flexValues = currentFence.blockOptions.flexValues || [];
                    var flex = function(i) { return flexValues[i] || 1; };
                    wrapper.className = 'columns columns-' + numParts;

                    if (numParts <= 3) {
                        // Single row: 1, 2, or 3 columns
                        wrapper.innerHTML = parts.map(function(p, i) {
                            return '<div class="columns-cell" style="flex:' + flex(i) + ';">' + p + '</div>';
                        }).join('');
                    } else {
                        // 4 parts → two rows of 2 columns each
                        var rows = [];
                        for (var r = 0; r < numParts; r += 2) {
                            var cells = '<div class="columns-cell" style="flex:' + flex(r) + ';">' + parts[r] + '</div>';
                            if (r + 1 < numParts) {
                                cells += '<div class="columns-cell" style="flex:' + flex(r + 1) + ';">' + parts[r + 1] + '</div>';
                            }
                            rows.push('<div class="columns-row">' + cells + '</div>');
                        }
                        wrapper.innerHTML = rows.join('');
                    }
                } else {
                    // For other block types, recursively process captured nodes first
                    var processedInnerNodes = processFencedBlocks(currentFence.capturedNodes);
                    for (var j = 0; j < processedInnerNodes.length; j++) {
                        wrapper.appendChild(processedInnerNodes[j]);
                    }
                }

                // Add wrapper to outer fence's captured nodes, or to newNodes if at top level
                if (fenceStack.length > 0) {
                    fenceStack[fenceStack.length - 1].capturedNodes.push(wrapper);
                } else {
                    newNodes.push(wrapper);
                }
                continue;
            }
        }

        // Add node to current capturing context
        if (fenceStack.length > 0) {
            fenceStack[fenceStack.length - 1].capturedNodes.push(node);
        } else {
            newNodes.push(node);
        }
    }

    // If any blocks were unclosed, append their nodes at the end to prevent content loss.
    for (var k = 0; k < fenceStack.length; k++) {
        newNodes.push.apply(newNodes, fenceStack[k].capturedNodes);
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

    // Extract logo paths from the document
    var logoPath = null;
    var logo1Path = null;

    // Check for logo1: syntax in the document
    var documentText = md.textContent;
    var logo1Match = documentText.match(/logo1:\s*([^\s\n]+)/i);
    if (logo1Match) {
        logo1Path = logo1Match[1].trim();
        // Remove the logo1 line from the document to avoid it being displayed
        md.innerHTML = md.innerHTML.replace(/logo1:\s*([^\s\n]+)/i, '');
    }

    // Check for logo: syntax in the document
    var logoMatch = md.textContent.match(/logo:\s*([^\s\n]+)/i);
    if (logoMatch) {
        logoPath = logoMatch[1].trim();
        // Remove the logo line from the document to avoid it being displayed
        md.innerHTML = md.innerHTML.replace(/logo:\s*([^\s\n]+)/i, '');
    }

    // Re-extract child nodes after removing logo lines
    es = Array.from(md.childNodes);

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

        // Parse for a new section marker: %%章节名%% or ==章节名==
        var sectionMatch = e.textContent.trim().match(/^(?:%%(.*)%%|==(.+)==)$/);
        if (sectionMatch) {
            nextSectionName = sectionMatch[1] !== undefined ? sectionMatch[1] : sectionMatch[2];
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

            // Determine which logo to use based on slide content
            var currentLogoPath = null;

            // Check if this is the title slide (slideCount == 0)
            var isTitleSlide = (slideCount === 0);

            // Check if the slide starts with an H1 or H2 tag
            var hasH1 = false;
            var hasH2 = false;

            // Check the currentSlide array for H1 or H2 tags
            for (var k = 0; k < currentSlide.length; k++) {
                var node = currentSlide[k];
                if (node.tagName === "H1") {
                    hasH1 = true;
                    break;
                } else if (node.tagName === "H2") {
                    hasH2 = true;
                    break;
                }
            }

            // Choose logo based on slide type
            if ((isTitleSlide || hasH1)) {
                // For title slide and H1 slides, only use logo1 if it exists
                if (logo1Path) {
                    currentLogoPath = logo1Path;
                }
                // If logo1 doesn't exist, don't show any logo for these slides
            } else if (logoPath) {
                // For other slides (including those starting with H2), use logo if it exists
                currentLogoPath = logoPath;
            }

            // Add the appropriate logo to the slide
            if (currentLogoPath) {
                var logoImg = document.createElement('img');
                logoImg.className = "slide-logo";
                logoImg.src = currentLogoPath;
                logoImg.alt = "Logo";
                slide.appendChild(logoImg);
            }

            // slide number (skip title slide)
            if (slideCount != 0) {
                var sn = document.createElement('div');
                sn.className = "slide-number";
                sn.innerHTML = buildSlideNumberMarkup(slideCount, totalSlideCount);
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
                sp.setAttribute("style", buildSlideProgressStyle(slideCount, totalSlideCount));
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
            sc.querySelectorAll('li').forEach(function (li) {
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

            slide.appendChild(sc);
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
                sn.innerHTML = buildSlideNumberMarkup(i, totalSlideCount);
                if (options.totalSlideNumber) {
                    sn.querySelector('.slide-number-total').style.display = 'inline';
                }
            }

            var sp = slide.querySelector('.slide-progress');
            if (sp) {
                sp.setAttribute("style", buildSlideProgressStyle(i, totalSlideCount));
            }
        }
    }

    // Inject CSS for the nav bar
    injectNavBarStyles();

    injectFontSizeButtonStyles();
    addFontSizeButtonsToSlides(slides);

    injectEditButtonStyles();
    addEditButtonToSlides(slides);
    addFullSourceButtonToSlides(slides);

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
            navBar.children[0].onclick = function () { gotoSlide(1); return false; };
            // Other children are section links
            for (let j = 0; j < sections.length; j++) {
                let navItem = navBar.children[j + 1];
                let section = sections[j];
                navItem.onclick = function () { gotoSlide(section.startSlide); return false; };
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
        e.innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });

    // further initialization steps
    processLocationHash();
    addLetterboxing();
    relativizeDiagrams(options.diagramZoom);
    pauseVideos();
    initVisualizations();

    // Convert blockquotes with [!type] syntax into admonitions
    function processAdmonitionBlockquotes() {
        // This regex is designed to match only the first line if it's an admonition marker line.
        var admonitionLineRegex = /(^\s*\[!(\w+)\]\s*(.*)?)(\r\n|\r|\n|$)/;

        document.querySelectorAll('.slide-content blockquote').forEach(function (bq) {
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
        .toc-list.single-column {
            column-width: auto;
            column-count: 1;
        }
        
        /* Logo styles */
        .slide-logo {
            position: absolute;
            margin-top: calc(var(--slide-height) / 10 - 1rem);
            right: 0.1rem;
            z-index: 1000;
            max-width: 4rem !important;
            max-height: 4rem !important;
            opacity: 1;
        }
        .presentation.taller .slide-logo{
            margin-top: calc(var(--slide-letterbox-height) / 2 + 1em);
        }
        .presentation.wider .slide-logo{
            margin-top: left: calc(var(--slide-letterbox-width) / 2 + 1em);
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
    list.className = "toc-list single-column"; // Use class for styling, default to single column
    // Store reference to the list for later use by the toggle button
    list.dataset.tocList = true;

    for (var section of sections) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.textContent = section.name;
        link.href = "#";
        // Use a closure to capture the correct, final startSlide value
        (function (s) {
            link.onclick = function () { gotoSlide(s.startSlide); return false; };
        })(section);
        item.appendChild(link);
        list.appendChild(item);
    }
    sc.appendChild(list);
    slide.appendChild(sc);

    // Also need to add slide number and progress bar for consistency
    var sn = document.createElement('div');
    sn.className = "slide-number";
    sn.innerHTML = buildSlideNumberMarkup(1, totalSlideCount);
    slide.appendChild(sn);

    // Ensure total slide number is visible if option is set
    if (options.totalSlideNumber) {
        sn.querySelector('.slide-number-total').style.display = 'inline';
    }

    var sp = document.createElement('div');
    sp.className = "slide-progress";
    sp.setAttribute("style", buildSlideProgressStyle(1, totalSlideCount));
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
        chartLibraryUrls: {
            chartjs: 'https://cdn.jsdelivr.net/npm/chart.js',
            d3: 'https://cdn.jsdelivr.net/npm/d3',
            echarts: 'https://cdn.jsdelivr.net/npm/echarts',
            mermaid: 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js'
        },
        slideChangeHook: (oldSlide, newSlide) => { },
        modeChangeHook: (newMode) => { }
    };

    if (typeof markdeepSlidesOptions !== 'undefined') {
        options = Object.assign({}, options, markdeepSlidesOptions);
    }
}

// Scale any MathJax SVG formula that overflows its slide.
// Strategy: modify the SVG's `width`/`height` attributes (which are in `ex` units)
// rather than changing CSS font-size.  Changing font-size causes CJK <text> elements
// inside the SVG to inherit the smaller size while their MathJax-computed positions
// stay fixed — producing abnormally large letter spacing.  Changing the SVG's own
// size attributes keeps viewBox and internal coordinates intact, so the browser
// scales everything (paths AND text) uniformly via the SVG viewport.
function scaleMathJaxToFit() {
    document.querySelectorAll('.slide-content .MathJax_SVG svg').forEach(function (svg) {
        var mathSpan = svg.closest('.MathJax_SVG');
        if (!mathSpan) return;

        // On first call: cache the natural dimensions so we can restore them later.
        var origW = svg.getAttribute('data-orig-width');
        var origH = svg.getAttribute('data-orig-height');
        if (origW === null) {
            origW = svg.getAttribute('width') || '';
            origH = svg.getAttribute('height') || '';
            svg.setAttribute('data-orig-width', origW);
            svg.setAttribute('data-orig-height', origH);
        } else {
            // Restore natural size before measuring so the ratio is always
            // computed from the formula's unscaled width at the current zoom.
            svg.setAttribute('width', origW);
            svg.setAttribute('height', origH);
        }

        var container = mathSpan.closest('.slide-content');
        if (!container) return;
        // Use the content-area width (excluding padding) so the formula is
        // compared against the space actually available for text, not the full
        // border-box width that getBoundingClientRect returns.
        var cs = window.getComputedStyle(container);
        var containerWidth = container.getBoundingClientRect().width
            - parseFloat(cs.paddingLeft  || 0)
            - parseFloat(cs.paddingRight || 0);
        if (!containerWidth) return;

        var mathWidth = mathSpan.getBoundingClientRect().width;
        if (mathWidth <= containerWidth) return;

        var ratio = containerWidth / mathWidth;
        var wNum = parseFloat(origW);
        var hNum = parseFloat(origH);
        if (!isNaN(wNum) && !isNaN(hNum)) {
            svg.setAttribute('width',  (wNum * ratio).toFixed(3) + 'ex');
            svg.setAttribute('height', (hNum * ratio).toFixed(3) + 'ex');
        }
    });
}

// initialize mathjax
function initMathJax() {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "markdeep-slides/lib/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_SVG"; //这里使用相对路径2511151223
    script.onload = function () {
        // Register once: after every MathJax typeset pass, scale overflowing formulas.
        // requestAnimationFrame defers until the SVG is painted so getBoundingClientRect
        // returns real layout values rather than zero.
        MathJax.Hub.Register.MessageHook("End Process", function () {
            requestAnimationFrame(scaleMathJaxToFit);
        });
    };
    document.getElementsByTagName("head")[0].appendChild(script);
}

var _markdeepSlidesLibraryPromises = {};
var _markdeepSlidesCharts = [];
var _markdeepMermaidInitialized = false;
var _markdeepMermaidCounter = 0;
var _markdeepMermaidRenderQueue = Promise.resolve();

function loadExternalLibrary(globalName, url) {
    if (window[globalName]) {
        return Promise.resolve(window[globalName]);
    }
    if (_markdeepSlidesLibraryPromises[globalName]) {
        return _markdeepSlidesLibraryPromises[globalName];
    }

    _markdeepSlidesLibraryPromises[globalName] = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = function () { resolve(window[globalName]); };
        script.onerror = function () { reject(new Error('无法加载图表库：' + url)); };
        document.head.appendChild(script);
    });

    return _markdeepSlidesLibraryPromises[globalName];
}

function parseChartJson(sourceEl) {
    var text = sourceEl.textContent.trim();
    if (!text) return null;
    return JSON.parse(text);
}

function replaceChartSource(sourceEl, className, height) {
    var wrapper = document.createElement('div');
    wrapper.className = 'markdeep-chart ' + className;
    var explicitHeight = height || sourceEl.getAttribute('data-height');
    if (explicitHeight) {
        wrapper.style.height = explicitHeight;
        wrapper.style.minHeight = '0';
    } else {
        wrapper.style.height = '12rem';
        wrapper.style.minHeight = '8rem';
    }
    sourceEl.parentNode.replaceChild(wrapper, sourceEl);
    sourceEl._markdeepChartWrapper = wrapper;
    return wrapper;
}

function showChartError(sourceEl, message) {
    var wrapper;
    if (sourceEl.parentNode) {
        wrapper = replaceChartSource(sourceEl, 'markdeep-chart-error', 'auto');
    } else {
        wrapper = sourceEl._markdeepChartWrapper;
        if (!wrapper) return;
        wrapper.className = 'markdeep-chart markdeep-chart-error';
        wrapper.style.height = 'auto';
        wrapper.innerHTML = '';
    }
    wrapper.textContent = message;
}

function renderChartJs(sourceEl) {
    var config = parseChartJson(sourceEl);
    var wrapper = replaceChartSource(sourceEl, 'markdeep-chartjs');
    var canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);

    return loadExternalLibrary('Chart', options.chartLibraryUrls.chartjs).then(function (Chart) {
        var chart = new Chart(canvas, config);
        _markdeepSlidesCharts.push({ type: 'chartjs', instance: chart, el: wrapper });
    });
}

function renderECharts(sourceEl) {
    var chartOptions = parseChartJson(sourceEl);
    var wrapper = replaceChartSource(sourceEl, 'markdeep-echarts');

    return loadExternalLibrary('echarts', options.chartLibraryUrls.echarts).then(function (echarts) {
        var chart = echarts.init(wrapper);
        chart.setOption(chartOptions);
        _markdeepSlidesCharts.push({ type: 'echarts', instance: chart, el: wrapper });
        setTimeout(function () { chart.resize(); }, 0);
    });
}

function renderMermaid(sourceEl) {
    var definition = sourceEl.textContent.trim();
    var wrapper = replaceChartSource(sourceEl, 'markdeep-mermaid');

    return loadExternalLibrary('mermaid', options.chartLibraryUrls.mermaid).then(function (mermaid) {
        if (!_markdeepMermaidInitialized) {
            mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
            _markdeepMermaidInitialized = true;
        }

        _markdeepMermaidRenderQueue = _markdeepMermaidRenderQueue.catch(function () { }).then(function () {
            var renderId = 'markdeep-mermaid-' + (++_markdeepMermaidCounter);
            return mermaid.render(renderId, definition).then(function (result) {
                wrapper.innerHTML = result.svg;
                if (result.bindFunctions) {
                    result.bindFunctions(wrapper);
                }
            });
        });

        return _markdeepMermaidRenderQueue;
    });
}

function renderSVG(sourceEl) {
    var svgContent = sourceEl.textContent.trim();
    var explicitHeight = sourceEl.getAttribute('data-height');
    var wrapper = replaceChartSource(sourceEl, 'markdeep-svg', explicitHeight || 'auto');
    wrapper.innerHTML = svgContent;
    var svgEl = wrapper.querySelector('svg');
    if (svgEl) {
        if (!svgEl.getAttribute('viewBox') && svgEl.getAttribute('width') && svgEl.getAttribute('height')) {
            svgEl.setAttribute('viewBox', '0 0 ' + svgEl.getAttribute('width') + ' ' + svgEl.getAttribute('height'));
        }
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.display = 'block';
        svgEl.style.width = '100%';
        // 有显式高度时撑满容器，否则按 viewBox 比例自适应
        svgEl.style.height = explicitHeight ? '100%' : 'auto';
    }
    return Promise.resolve();
}

function renderD3Force(sourceEl) {
    var data = parseChartJson(sourceEl);
    var wrapper = replaceChartSource(sourceEl, 'markdeep-d3-force');

    return loadExternalLibrary('d3', options.chartLibraryUrls.d3).then(function (d3) {
        var width = wrapper.clientWidth || 800;
        var height = wrapper.clientHeight || 420;
        var nodes = (data.nodes || []).map(function (node) { return Object.assign({}, node); });
        var links = (data.links || []).map(function (link) { return Object.assign({}, link); });
        var color = d3.scaleOrdinal(d3.schemeTableau10);

        var svg = d3.select(wrapper)
            .append('svg')
            .attr('viewBox', [0, 0, width, height])
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('role', 'img');

        var link = svg.append('g')
            .attr('class', 'd3-force-links')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke-width', function (d) { return Math.sqrt(d.value || 1); });

        var node = svg.append('g')
            .attr('class', 'd3-force-nodes')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', function (d) { return d.r || 8; })
            .attr('fill', function (d) { return color(d.group || 0); });

        var label = svg.append('g')
            .attr('class', 'd3-force-labels')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .text(function (d) { return d.label || d.id; });

        var simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(data.linkDistance || 90))
            .force('charge', d3.forceManyBody().strength(data.charge || -260))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide().radius(function (d) { return (d.r || 8) + 6; }));

        simulation.on('tick', function () {
            link
                .attr('x1', function (d) { return d.source.x; })
                .attr('y1', function (d) { return d.source.y; })
                .attr('x2', function (d) { return d.target.x; })
                .attr('y2', function (d) { return d.target.y; });

            node
                .attr('cx', function (d) { return d.x; })
                .attr('cy', function (d) { return d.y; });

            label
                .attr('x', function (d) { return d.x + 10; })
                .attr('y', function (d) { return d.y + 4; });
        });

        _markdeepSlidesCharts.push({ type: 'd3-force', instance: simulation, el: wrapper });
    });
}

function initVisualizations() {
    normalizeChartCodeBlocks();
    var sources = Array.from(document.querySelectorAll('script.markdeep-chart[type="application/json"], script.markdeep-chart[type="text/plain"]'));

    sources.forEach(function (sourceEl) {
        var chartType = (sourceEl.getAttribute('data-chart') || '').toLowerCase();
        var renderPromise;

        try {
            if (chartType === 'chartjs' || chartType === 'chart.js') {
                renderPromise = renderChartJs(sourceEl);
            } else if (chartType === 'echarts') {
                renderPromise = renderECharts(sourceEl);
            } else if (chartType === 'mermaid') {
                renderPromise = renderMermaid(sourceEl);
            } else if (chartType === 'd3-force' || chartType === 'd3-network') {
                renderPromise = renderD3Force(sourceEl);
            } else if (chartType === 'svg') {
                renderPromise = renderSVG(sourceEl);
            } else {
                throw new Error('未知图表类型：' + chartType);
            }
        } catch (err) {
            showChartError(sourceEl, err.message);
            return;
        }

        renderPromise.catch(function (err) {
            showChartError(sourceEl, err.message);
        });
    });
}

function resizeVisualizations() {
    _markdeepSlidesCharts.forEach(function (chart) {
        if (chart.type === 'echarts' && chart.instance && chart.instance.resize) {
            chart.instance.resize();
        } else if (chart.type === 'chartjs' && chart.instance && chart.instance.resize) {
            chart.instance.resize();
        }
    });
}

function normalizeChartCodeBlocks() {
    document.querySelectorAll('pre.listing').forEach(function (pre) {
        var code = pre.querySelector('code');
        if (!code) return;

        var lines = code.textContent.split(/\r?\n/);
        var chartMatch = (lines[0] || '').trim().match(/^chart\s*:\s*([a-z0-9_.-]+)\s*$/i);
        if (!chartMatch) return;

        var chartType = chartMatch[1].toLowerCase();
        var height = null;
        var index = 1;

        while (index < lines.length) {
            var line = lines[index].trim();
            var heightMatch = line.match(/^height\s*:\s*(.+)$/i);
            if (heightMatch) { height = heightMatch[1].trim(); index++; continue; }
            if (line === '') { index++; continue; }
            break;
        }

        var sourceEl = document.createElement('script');
        sourceEl.type = (chartType === 'mermaid' || chartType === 'svg') ? 'text/plain' : 'application/json';
        sourceEl.className = 'markdeep-chart';
        sourceEl.setAttribute('data-chart', chartType);
        if (height) sourceEl.setAttribute('data-height', height);
        sourceEl.textContent = lines.slice(index).join('\n').trim();
        pre.parentNode.replaceChild(sourceEl, pre);
    });
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
window.addEventListener('resize', function () {
    addLetterboxing();
    resizeVisualizations();
});

// --- Print support for ECharts ---
// resize() schedules an async redraw via requestAnimationFrame, so Chrome can
// capture the print layout before the canvas is redrawn at the new size.
// Fix: after resize(), call getDataURL() which forces a synchronous redraw,
// then replace the live canvas with a static <img> so Chrome captures the
// correctly-sized chart. Restore after printing.
var _printMQ = window.matchMedia('print');
var _printChartImages = [];

function _onEnterPrintMode() {
    if (_printChartImages.length > 0) return; // avoid double-processing
    _markdeepSlidesCharts.forEach(function (chart) {
        if (chart.type !== 'echarts' || !chart.instance) return;
        var el = chart.el;
        var inner = el.querySelector('div'); // ECharts root container
        if (!inner) return;

        // Re-read container at print CSS dimensions (640px slide width)
        chart.instance.resize();

        // getDataURL() forces a synchronous ZRender flush, capturing the
        // redrawn chart at the new print dimensions
        var url;
        try {
            url = chart.instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: 'transparent' });
        } catch (e) { return; }

        // Hide the live ECharts DOM so it can't overflow the slide
        inner.style.display = 'none';

        // Insert a static image; width/height 100% fills the same container
        var img = document.createElement('img');
        img.className = 'markdeep-echarts-print';
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;object-position:top left;';
        el.appendChild(img);

        _printChartImages.push({ inner: inner, img: img });
    });
}

function _onExitPrintMode() {
    _printChartImages.forEach(function (item) {
        if (item.img.parentNode) item.img.parentNode.removeChild(item.img);
        item.inner.style.display = '';
    });
    _printChartImages = [];
    resizeVisualizations(); // restore to screen dimensions
}

if (_printMQ.addEventListener) {
    _printMQ.addEventListener('change', function (mq) {
        if (mq.matches) { _onEnterPrintMode(); } else { _onExitPrintMode(); }
    });
} else {
    _printMQ.addListener(function (mq) { // Safari < 14
        if (mq.matches) { _onEnterPrintMode(); } else { _onExitPrintMode(); }
    });
}

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

    document.querySelectorAll("svg.diagram").forEach(function (diag) {
        function toRem(px) {
            return (parseFloat(px) / baseRem) + "rem";
        }

        var w = diag.getAttribute("width"),
            h = diag.getAttribute("height");

        diag.removeAttribute("width");
        diag.removeAttribute("height");
        diag.setAttribute("viewBox", "0 0 " + w + " " + h);
        diag.style.width = toRem(w * zoom);
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
            topLevelElements.forEach(function (el) {
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
            var isNotInAppearBlock = function (element) { return !element.closest('[class^="appear"]'); };

            if (incrementalBlock) {
                var listItems = Array.from(incrementalBlock.querySelectorAll("li"));
                defaultBuilds = defaultBuilds.concat(listItems.filter(isNotInAppearBlock));
            } else if (incrementalFlatBlock) {
                var listItems = Array.from(incrementalFlatBlock.querySelectorAll(":scope > ul > li, :scope > ol > li"));
                defaultBuilds = defaultBuilds.concat(listItems.filter(isNotInAppearBlock));
            }

            // 2. Gather all 'appear' blocks and sort them into default or numbered
            // Use [class*="appear"] to match elements that contain 'appear' in their class list
            var appearBlocks = currentSlideEl.querySelectorAll('[class*="appear"]');
            var orderRegex = /appear(\d+)/;

            appearBlocks.forEach(function (block) {
                var match = block.className.match(orderRegex);
                if (match) {
                    var order = parseInt(match[1], 10);
                    numberedBuilds.push({ item: block, order: order });
                } else {
                    defaultBuilds.push(block);
                }
            });

            // 3. Sort numbered builds
            numberedBuilds.sort(function (a, b) { return a.order - b.order; });

            // 4. Concatenate everything: default builds first, then sorted numbered builds
            buildItems = defaultBuilds.concat(numberedBuilds.map(function (b) { return b.item; }));
        }

        // Reset visibility on all collected build items
        if (buildItems.length > 0) {
            buildItems.forEach(function (item) {
                item.classList.remove('visible');
            });
        }
    }
    currentBuildStep = 0;

    updatePresenterNotes(slideNum);
    setTimeout(resizeVisualizations, 0);
}

// load presenter notes for slide n into presenter notes window
function updatePresenterNotes(slideNum) {
    if (presenterNotesWindow) {
        var presenterNotesElement = document.getElementById("slide" + slideNum).querySelector(".slide-presenter-notes");
        var presenterNotes = "";
        if (presenterNotesElement) {
            presenterNotes = presenterNotesElement.innerHTML;
        }

        presenterNotesWindow.document.getElementById("slide-number").innerHTML = `<span class="current">${slideNum}</span><span class="total">/${getNumberedSlideCount(slideCount)}</span>`;
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

// Exit fullscreen (if currently active) and invoke callback once the browser
// has fully completed the transition.
//
// WHY THIS IS NEEDED (macOS / Edge / Chrome bug):
//   When a native dialog is shown (showOpenFilePicker, requestPermission) while
//   the browser is in HTML fullscreen mode, the browser forcefully exits fullscreen
//   without going through a clean OS-level transition. On macOS this leaves a
//   "ghost" fullscreen Space that cannot be dismissed — the user sees a blank
//   desktop and must force-quit the browser.
//   Calling exitFullscreen *before* opening any dialog lets macOS cleanly tear
//   down the Space first.
function exitFullscreenThen(callback) {
    if (!isFullscreen()) {
        callback();
        return;
    }

    var settled = false;
    function onSettled() {
        if (settled) return;
        settled = true;
        document.removeEventListener('fullscreenchange',       onSettled);
        document.removeEventListener('webkitfullscreenchange', onSettled);
        document.removeEventListener('mozfullscreenchange',    onSettled);
        document.removeEventListener('msfullscreenchange',     onSettled);
        // Give macOS an extra moment to finish its Space animation before
        // we display any native dialog.
        setTimeout(callback, 300);
    }

    document.addEventListener('fullscreenchange',       onSettled);
    document.addEventListener('webkitfullscreenchange', onSettled);
    document.addEventListener('mozfullscreenchange',    onSettled);
    document.addEventListener('msfullscreenchange',     onSettled);
    // Safety fallback: if fullscreenchange never fires, proceed anyway
    setTimeout(onSettled, 2000);

    if (document.exitFullscreen)            document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
    else if (document.msExitFullscreen)     document.msExitFullscreen();
    else callback(); // no fullscreen API available
}

// ============================================================
// 字号持久化 —— 通过 File System Access API 将字号标签写回源文件
// ============================================================

var _fontSizeFileHandle = null; // 当前 tab 内存缓存

// ── IndexedDB 辅助：跨刷新持久化 FileSystemFileHandle ──
var _IDB_NAME  = 'markdeep-slides-prefs';
var _IDB_STORE = 'fileHandles';
// 以当前页面路径为 key，每个 HTML 文件各自缓存独立的句柄
var _IDB_FONT_KEY = 'fontSizeFile:' + window.location.pathname;

function _idbOpen() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open(_IDB_NAME, 1);
        req.onupgradeneeded = function (e) {
            e.target.result.createObjectStore(_IDB_STORE);
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = function ()  { reject(req.error); };
    });
}
async function _idbGet(key) {
    try {
        var db = await _idbOpen();
        return new Promise(function (resolve) {
            var tx  = db.transaction(_IDB_STORE, 'readonly');
            var req = tx.objectStore(_IDB_STORE).get(key);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror   = function () { resolve(null); };
        });
    } catch (e) { return null; }
}
async function _idbPut(key, value) {
    try {
        var db = await _idbOpen();
        return new Promise(function (resolve) {
            var tx = db.transaction(_IDB_STORE, 'readwrite');
            tx.objectStore(_IDB_STORE).put(value, key);
            tx.oncomplete = function () { resolve(true); };
            tx.onerror    = function () { resolve(false); };
        });
    } catch (e) { return false; }
}

/** 转义正则特殊字符 */
function _regexEscape(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 在屏幕底部显示短暂的状态提示 */
function _showFontSaveToast(msg, isError) {
    var old = document.getElementById('_font-save-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = '_font-save-toast';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
        + 'background:' + (isError ? '#c0392b' : '#27ae60') + ';'
        + 'color:#fff;padding:5px 14px;border-radius:6px;font-size:13px;'
        + 'z-index:99999;opacity:1;transition:opacity 0.5s ease;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 500);
    }, 2500);
}

/**
 * 获取源文件的可读写句柄。
 * 优先级：内存缓存 → IndexedDB（跨刷新）→ 弹出文件选择器（仅首次或句柄失效时）。
 * 文件选择器打开时，以 IndexedDB 中存储的旧句柄目录作为起始路径。
 */
async function _getFontSizeFileHandle() {
    if (!window.showOpenFilePicker) {
        _showFontSaveToast('⚠ 浏览器不支持文件写入（请使用 Chrome 或 Edge）', true);
        return null;
    }

    // 1. 优先复用同一 tab 的内存缓存
    if (_fontSizeFileHandle) {
        try {
            var perm = await _fontSizeFileHandle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') return _fontSizeFileHandle;
            perm = await _fontSizeFileHandle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') return _fontSizeFileHandle;
        } catch (e) { _fontSizeFileHandle = null; }
    }

    // 2. 尝试从 IndexedDB 恢复跨刷新的句柄
    //    requestPermission 不会弹出文件选择器，只在浏览器顶部显示一次权限确认条
    var storedHandle = await _idbGet(_IDB_FONT_KEY);
    if (storedHandle) {
        try {
            var perm = await storedHandle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                _fontSizeFileHandle = storedHandle;
                return _fontSizeFileHandle;
            }
            perm = await storedHandle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                _fontSizeFileHandle = storedHandle;
                return _fontSizeFileHandle;
            }
        } catch (e) { /* 句柄失效，继续走文件选择器 */ }
    }

    // 3. 首次或句柄彻底失效：弹出文件选择器
    //    用 storedHandle 作为 startIn，使选择器默认打开源文件所在目录
    try {
        var pickerOpts = {
            types: [{ description: 'HTML 幻灯片', accept: { 'text/html': ['.html'] } }],
            multiple: false
        };
        if (storedHandle) pickerOpts.startIn = storedHandle;

        var handles = await window.showOpenFilePicker(pickerOpts);
        _fontSizeFileHandle = handles[0];
        var perm = await _fontSizeFileHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') { _fontSizeFileHandle = null; return null; }
        // 写入 IndexedDB，下次刷新后免选
        await _idbPut(_IDB_FONT_KEY, _fontSizeFileHandle);
        return _fontSizeFileHandle;
    } catch (e) {
        return null; // 用户取消，静默处理
    }
}

/**
 * 将字号设置写回源 HTML 文件中对应幻灯片位置。
 * @param {Element} slideEl  - 幻灯片 DOM 元素
 * @param {string|null} targetClass - 'small-text' | 'tiny-text' | null（恢复正常）
 */
async function _persistFontSizeToSource(slideEl, targetClass) {
    // 取得幻灯片标题，用于定位源文件中的位置
    var headingEl = slideEl.querySelector('h1, h2, h3, h4, h5, h6');
    if (!headingEl) {
        _showFontSaveToast('⚠ 未找到幻灯片标题，无法保存', true);
        return;
    }
    var headingText = headingEl.textContent.trim();
    var headingLevel = parseInt(headingEl.tagName[1], 10);
    var hashes = '#'.repeat(headingLevel);

    var fh = await _getFontSizeFileHandle();
    if (!fh) return;

    var file = await fh.getFile();
    var source = await file.text();

    // 在源文件中查找对应的标题行（允许标题文字前后存在 Markdown 粗体 **...** 标记）
    var esc = _regexEscape(headingText);
    var headingLineRe = new RegExp(
        '(^' + _regexEscape(hashes) + '[ \\t]+[*_]*)(' + esc + ')([*_]*[ \\t]*(?:\\r?\\n|\\r))', 'm');
    var hm = source.match(headingLineRe);
    if (!hm) {
        // 降级：忽略 # 数量做模糊匹配
        hm = source.match(new RegExp(
            '(^#{1,6}[ \\t]+[*_]*)(' + esc + ')([*_]*[ \\t]*(?:\\r?\\n|\\r))', 'm'));
    }
    if (!hm) {
        _showFontSaveToast('⚠ 源文件中未找到幻灯片"' + headingText.substring(0, 10) + '…"', true);
        return;
    }

    var headingEndIdx = hm.index + hm[0].length;
    var afterHeading = source.substring(headingEndIdx);

    // 查找下一个幻灯片边界（H1/H2 标题行 或 HR 分隔线 ---）
    var nextBoundaryMatch = afterHeading.match(/\n(?=#{1,2}[ \t]|---[ \t]*(?:\r?\n|\r|\s*$))/m);
    var contentLen = nextBoundaryMatch ? nextBoundaryMatch.index + 1 : afterHeading.length;
    var slideContent = afterHeading.substring(0, contentLen);

    // 移除已有的字号标签（无论位于幻灯片内容中的哪个位置）
    slideContent = slideContent.replace(/[ \t]*\[small-text\][ \t]*\r?\n?/g, '');
    slideContent = slideContent.replace(/[ \t]*\[tiny-text\][ \t]*\r?\n?/g, '');
    // 清理连续三行以上的空行
    slideContent = slideContent.replace(/\n{3,}/g, '\n\n');
    // 保证内容以单个换行开头（标题行已带换行符，此处补齐）
    slideContent = slideContent.replace(/^\n*/, '\n');

    // 在幻灯片内容开头插入新的字号标签，前后各保留一个空行
    if (targetClass === 'small-text') {
        slideContent = '\n[small-text]\n\n' + slideContent.replace(/^\n+/, '');
    } else if (targetClass === 'tiny-text') {
        slideContent = '\n[tiny-text]\n\n' + slideContent.replace(/^\n+/, '');
    }

    var newSource = source.substring(0, headingEndIdx) + slideContent + afterHeading.substring(contentLen);

    try {
        var writable = await fh.createWritable();
        await writable.write(newSource);
        await writable.close();
        var label = targetClass === 'small-text' ? '缩小 (○)' :
                    targetClass === 'tiny-text'  ? '极小 (-)' : '正常 (+)';
        _showFontSaveToast('✓ 字号已保存至源文件：' + label, false);
    } catch (e) {
        _showFontSaveToast('⚠ 写入失败：' + e.message, true);
        console.error('[markdeep-slides] 写回字号标签失败：', e);
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
    var smallButtonOnClick = function () {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('tiny-text');
            slide.classList.add('small-text');
            exitFullscreenThen(function () { _persistFontSizeToSource(slide, 'small-text'); });
        }
    };

    var tinyButton = document.createElement('button');
    tinyButton.textContent = '-';
    tinyButton.title = '进一步缩小字体';
    var tinyButtonOnClick = function () {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('small-text');
            slide.classList.add('tiny-text');
            exitFullscreenThen(function () { _persistFontSizeToSource(slide, 'tiny-text'); });
        }
    };

    var resetButton = document.createElement('button');
    resetButton.textContent = '+';
    resetButton.title = '恢复正常字体';
    var resetButtonOnClick = function () {
        var slide = this.closest('.slide');
        if (slide) {
            slide.classList.remove('small-text');
            slide.classList.remove('tiny-text');
            exitFullscreenThen(function () { _persistFontSizeToSource(slide, null); });
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

        // Check if this is the toc slide (slide1) and add the toggle button
        if (slide.id === 'slide1') {
            var tocList = slide.querySelector('.toc-list');
            if (tocList) {
                var toggleButton = document.createElement('button');
                toggleButton.textContent = '=';
                toggleButton.title = '切换目录显示模式';
                toggleButton.onclick = function () {
                    tocList.classList.toggle('single-column');
                    if (tocList.classList.contains('single-column')) {
                        this.textContent = '=';
                    } else {
                        this.textContent = '≡';
                    }
                };

                // Copy styles from fontsize-buttons button
                toggleButton.style.padding = '2px 8px';
                toggleButton.style.fontSize = '0.5em';
                toggleButton.style.backgroundColor = 'transparent';
                toggleButton.style.border = 'none';
                toggleButton.style.borderRadius = '4px';
                toggleButton.style.cursor = 'pointer';

                buttons.appendChild(toggleButton);
            }
        }

        slide.appendChild(buttons);
    }
}

// ============================================================
// ============================================================
// 幻灯片源码编辑 —— 弹出 textarea 直接编辑对应的 Markdown 原文
// ============================================================

function injectEditButtonStyles() {
    var style = document.createElement('style');
    style.textContent = `
        .fontsize-buttons .edit-mode-btn        { color: #bbb; }
        .fontsize-buttons .edit-mode-btn.active { color: #3498db; }
        .slide-edit-overlay {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            width: min(90vw, 52rem);
            height: min(55vh, 20rem);
            z-index: 3000;
            display: flex; flex-direction: column;
            background: #fff;
            border: 1px solid #b0cfe8;
            border-radius: 8px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            padding: 8px; box-sizing: border-box;
        }
        .slide-edit-overlay textarea {
            flex: 1;
            font-family: monospace; font-size: 13px;
            resize: none; border: 1px solid #b0cfe8;
            border-radius: 4px; padding: 8px;
            line-height: 1.5;
        }
        .slide-edit-overlay .edit-bar {
            display: flex; justify-content: center;
            gap: 12px; padding: 6px 0 0;
            font-size: 13px;
        }
        .slide-edit-overlay .edit-bar button {
            padding: 3px 16px; border-radius: 4px;
            border: none; cursor: pointer; font-size: 1em;
        }
        .slide-edit-overlay .edit-save-btn   { background: #2ecc71; color: #fff; }
        .slide-edit-overlay .edit-cancel-btn { background: #e74c3c; color: #fff; }
        .fontsize-buttons .full-source-btn   { color: #bbb; }
        .full-source-overlay {
            position: fixed; inset: 0;
            z-index: 99999;
            display: flex; flex-direction: column;
            background: #fff;
            padding: 16px; box-sizing: border-box;
        }
        .full-source-overlay .fs-title {
            font-size: 13px; font-weight: bold;
            color: #555; margin-bottom: 8px;
        }
        .full-source-overlay textarea {
            flex: 1;
            font-family: monospace; font-size: 13px;
            resize: none; border: 1px solid #ccc;
            border-radius: 4px; padding: 8px;
            line-height: 1.5;
        }
        .full-source-overlay .fs-bar {
            display: flex; justify-content: center;
            gap: 12px; padding: 10px 0 0;
        }
        .full-source-overlay .fs-bar button {
            padding: 5px 20px; border-radius: 4px;
            border: none; cursor: pointer; font-size: 13px;
        }
        .full-source-overlay .fs-save-btn  { background: #2ecc71; color: #fff; }
        .full-source-overlay .fs-close-btn { background: #e74c3c; color: #fff; }
    `;
    document.head.appendChild(style);
}

function addEditButtonToSlides(slides) {
    for (var i = 1; i < slides.length; i++) {
        var slide = slides[i];
        var btnContainer = slide.querySelector('.fontsize-buttons');
        if (!btnContainer) continue;

        var editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.title = '编辑幻灯片文字';
        editBtn.className = 'edit-mode-btn';
        editBtn.onclick = (function (slideEl, btn) {
            return function (e) {
                e.stopPropagation();
                toggleEditMode(slideEl, btn);
            };
        })(slide, editBtn);

        btnContainer.appendChild(editBtn);
    }
}

function toggleEditMode(slideEl, btn) {
    // 已有覆盖层则忽略重复点击
    if (slideEl.querySelector('.slide-edit-overlay')) return;
    // Exit fullscreen first to avoid the macOS "ghost Space" bug that occurs
    // when showOpenFilePicker / requestPermission is called while fullscreen.
    exitFullscreenThen(function () { enterEditMode(slideEl, btn); });
}

function addFullSourceButtonToSlides(slides) {
    for (var i = 1; i < slides.length; i++) {
        var btnContainer = slides[i].querySelector('.fontsize-buttons');
        if (!btnContainer) continue;
        var btn = document.createElement('button');
        btn.textContent = '❏';
        btn.title = '查看 / 编辑完整 Markdown 源文件';
        btn.className = 'full-source-btn';
        btn.onclick = function (e) {
            e.stopPropagation();
            // Exit fullscreen first to avoid the macOS "ghost Space" bug
            exitFullscreenThen(function () { showFullSourceOverlay(); });
        };
        btnContainer.appendChild(btn);
    }
}

async function showFullSourceOverlay() {
    var fh = await _getFontSizeFileHandle();
    if (!fh) return;

    var file   = await fh.getFile();
    var source = await file.text();

    var overlay = document.createElement('div');
    overlay.className = 'full-source-overlay';

    var title = document.createElement('div');
    title.className = 'fs-title';
    title.textContent = file.name;

    var ta = document.createElement('textarea');
    ta.value = source;
    ta.spellcheck = false;

    var bar = document.createElement('div');
    bar.className = 'fs-bar';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '✓ 保存';
    saveBtn.className = 'fs-save-btn';
    saveBtn.onclick = async function (e) {
        e.stopPropagation();
        try {
            var w = await fh.createWritable();
            await w.write(ta.value);
            await w.close();
            overlay.remove();
            _showFontSaveToast('✓ 已保存', false);
        } catch (err) {
            _showFontSaveToast('⚠ 写入失败：' + err.message, true);
        }
    };

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✗ 关闭';
    closeBtn.className = 'fs-close-btn';
    closeBtn.onclick = function () { overlay.remove(); };

    bar.appendChild(saveBtn);
    bar.appendChild(closeBtn);
    overlay.appendChild(title);
    overlay.appendChild(ta);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
    ta.focus();
}

// 返回页面原始 Markdown 源内容。
// 优先直接读取磁盘文件（句柄已缓存时无需弹窗），避免 _markdeepRawSource
// 经过 outerHTML 序列化后 > 被编码为 &gt; 的问题。
async function _readSourceContent() {
    // 1. 优先：内存中已有文件句柄，直接读磁盘，内容最准确
    if (_fontSizeFileHandle) {
        try {
            var f = await _fontSizeFileHandle.getFile();
            return await f.text();
        } catch (e) { /* 权限过期，继续回退 */ }
    }

    // 2. 兜底：DOM 捕获的原始文本（仅在尚未获取文件句柄时使用）
    if (window._markdeepRawSource) return window._markdeepRawSource;

    if (/^https?:$/i.test(window.location.protocol)) {
        try {
            var response = await fetch(window.location.href, { cache: 'no-store' });
            if (response.ok) return await response.text();
        } catch (e) { /* 继续回退到文件选择器 */ }
    }

    var fh = await _getFontSizeFileHandle();
    if (!fh) return null;

    try {
        var file = await fh.getFile();
        return await file.text();
    } catch (e) {
        return null;
    }
}

// 在 source 文本中定位 slideEl 对应的幻灯片边界，返回 {slideStart, slideEnd} 或 null
function _findSlideBoundaries(source, slideEl) {
    var headingEl = slideEl.querySelector('h1, h2, h3, h4, h5, h6');
    var slideStart = 0, slideEnd = source.length;
    if (!headingEl) return { slideStart: slideStart, slideEnd: slideEnd };
    var headingText = headingEl.textContent.trim();
    var level = parseInt(headingEl.tagName[1], 10);
    var hashes = '#'.repeat(level);
    var esc = _regexEscape(headingText);
    var hm = source.match(new RegExp(
        '(^' + _regexEscape(hashes) + '[ \\t]+[*_]*)(' + esc + ')([*_]*[ \\t]*(?:\\r?\\n|\\r))', 'm'));
    if (!hm) {
        hm = source.match(new RegExp(
            '(^#{1,6}[ \\t]+[*_]*)(' + esc + ')([*_]*[ \\t]*(?:\\r?\\n|\\r))', 'm'));
    }
    if (!hm) return null;
    slideStart = hm.index;
    var after = source.substring(hm.index + hm[0].length);
    var nb = after.match(/\n(?=#{1,2}[ \t]|---[ \t]*(?:\r?\n|\r|\s*$))/m);
    slideEnd = hm.index + hm[0].length + (nb ? nb.index + 1 : after.length);
    return { slideStart: slideStart, slideEnd: slideEnd };
}



/**
 * 点击 ✎ 后：读取源文件，找到本张幻灯片对应的 Markdown 原文，
 * 弹出 textarea 覆盖层供用户直接编辑，保存时整段替换回源文件。
 */
async function enterEditMode(slideEl, btn) {
    // 直接从磁盘读文件，避免 _markdeepRawSource 经 outerHTML 序列化后
    // > 被编码为 &gt; 的问题。与 showFullSourceOverlay 使用相同路径。
    var fh = await _getFontSizeFileHandle();
    if (!fh) return;

    var source;
    try {
        source = await (await fh.getFile()).text();
    } catch (e) {
        _showFontSaveToast('⚠ 读取文件失败：' + e.message, true);
        return;
    }

    var bounds = _findSlideBoundaries(source, slideEl);
    if (!bounds) {
        _showFontSaveToast('⚠ 源文件中未找到幻灯片标题', true);
        return;
    }
    var slideSource = source.substring(bounds.slideStart, bounds.slideEnd);

    // ── 构建覆盖层 ──────────────────────────────────────────────────────────
    if (btn) btn.classList.add('active');

    var overlay = document.createElement('div');
    overlay.className = 'slide-edit-overlay';

    var ta = document.createElement('textarea');
    ta.value = slideSource;
    ta.spellcheck = false;

    var bar = document.createElement('div');
    bar.className = 'edit-bar';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '✓ 保存';
    saveBtn.className = 'edit-save-btn';
    saveBtn.onclick = async function (e) {
        e.stopPropagation();
        try {
            var w = await fh.createWritable();
            await w.write(source.substring(0, bounds.slideStart) + ta.value + source.substring(bounds.slideEnd));
            await w.close();
            overlay.remove();
            if (btn) btn.classList.remove('active');
            _showFontSaveToast('✓ 已保存', false);
        } catch (err) {
            _showFontSaveToast('⚠ 写入失败：' + err.message, true);
        }
    };

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✗ 取消';
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.onclick = function (e) {
        e.stopPropagation();
        overlay.remove();
        if (btn) btn.classList.remove('active');
    };

    bar.appendChild(saveBtn);
    bar.appendChild(cancelBtn);
    overlay.appendChild(ta);
    overlay.appendChild(bar);
    slideEl.appendChild(overlay);
    ta.focus();
}

function fullscreenActions() {
    enableScroll = false;

    var fullscreen = isFullscreen();
    options.modeChangeHook(fullscreen ? "presentation" : "draft");

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

// ── Overview zoom helpers ────────────────────────────────────────────────────

// Compute card pixel width for a given column count.
function computeOverviewCardWidth(cols) {
    var gap = 15;      // matches CSS gap: 15px
    var padding = 30;  // matches CSS padding: 30px on each side
    var availWidth = window.innerWidth - 2 * padding - (cols - 1) * gap;
    return Math.max(60, availWidth / cols);
}

// Set card dimensions and scale via CSS custom properties on <html>.
// .slide-content is fixed at 1680×948px (the 280px-card reference layout).
// scale = 0.15 × (cardWidth / 280), so text grows/shrinks proportionally
// with the card — visual font size = dom_font_size × scale.
var OV_REF_W = 280;   // reference card width that corresponds to scale 0.15
var OV_BASE_SCALE = 0.15;
function applyOverviewZoom() {
    var cardWidth  = Math.round(computeOverviewCardWidth(overviewColumns));
    var cardHeight = Math.round(cardWidth * 9 / 16);
    var scale = OV_BASE_SCALE * cardWidth / OV_REF_W;
    document.documentElement.style.setProperty('--ov-card-w', cardWidth  + 'px');
    document.documentElement.style.setProperty('--ov-card-h', cardHeight + 'px');
    document.documentElement.style.setProperty('--ov-scale',  scale.toFixed(5));
}

// Create (or refresh) the floating zoom toolbar shown in overview mode.
function ensureOverviewToolbar() {
    if (document.getElementById('overview-toolbar')) {
        updateOverviewToolbarState();
        return;
    }

    var toolbar = document.createElement('div');
    toolbar.id = 'overview-toolbar';

    var btnOut = document.createElement('button');
    btnOut.className = 'ov-zoom-btn';
    btnOut.id = 'overview-zoom-out';
    btnOut.title = '缩小缩略图';
    btnOut.textContent = '−';
    btnOut.onclick = function (e) {
        e.stopPropagation();
        if (overviewColumns < 10) {
            overviewColumns++;
            applyOverviewZoom();
            updateOverviewToolbarState();
        }
    };

    var btnIn = document.createElement('button');
    btnIn.className = 'ov-zoom-btn';
    btnIn.id = 'overview-zoom-in';
    btnIn.title = '放大缩略图';
    btnIn.textContent = '+';
    btnIn.onclick = function (e) {
        e.stopPropagation();
        if (overviewColumns > 2) {
            overviewColumns--;
            applyOverviewZoom();
            updateOverviewToolbarState();
        }
    };

    toolbar.appendChild(btnOut);
    toolbar.appendChild(btnIn);
    document.body.appendChild(toolbar);

    updateOverviewToolbarState();
}

function updateOverviewToolbarState() {
    var btnOut = document.getElementById('overview-zoom-out');
    var btnIn  = document.getElementById('overview-zoom-in');
    if (btnOut) { btnOut.disabled = (overviewColumns >= 10); }
    if (btnIn)  { btnIn.disabled  = (overviewColumns <= 2);  }
}

// Apply the current pinch transform to .md.
// transform: translate then scale around origin (0,0) of .md.
function applyOverviewTransform() {
    var mdEl = document.querySelector('.md');
    if (!mdEl) return;
    if (ovPinchScale === 1.0 && ovPinchTx === 0 && ovPinchTy === 0) {
        mdEl.style.transform      = '';
        mdEl.style.transformOrigin = '';
    } else {
        mdEl.style.transformOrigin = '0 0';
        mdEl.style.transform =
            'translate(' + ovPinchTx.toFixed(2) + 'px,' +
                           ovPinchTy.toFixed(2) + 'px) ' +
            'scale(' + ovPinchScale.toFixed(5) + ')';
    }
}

function resetOverviewTransform() {
    ovPinchScale = 1.0;
    ovPinchTx    = 0;
    ovPinchTy    = 0;
    applyOverviewTransform();
}

// Handle all wheel events in overview mode.
//
// ctrlKey = true  → trackpad pinch-to-zoom
// ctrlKey = false → trackpad two-finger drag to pan
//
// Both use CSS transform (translate + scale) on .md so the flex layout is
// NEVER reflowed — column count stays fixed, out-of-bounds content is
// accessible by panning.
//
// Zoom math (transform-origin: 0 0, apply translate then scale):
//   .md local (px,py) → viewport:  (Tx + px·S − scrollX,  Ty + py·S − scrollY)
//   To keep the cursor point fixed when scale changes by ratio R = S_new/S_old:
//     Tx_new = (clientX + scrollX) · (1 − R) + Tx · R
//     Ty_new = (clientY + scrollY) · (1 − R) + Ty · R
//
// Pan math:
//   Moving .md by −Δ (opposite to scroll delta) mirrors normal page-scroll feel.
function handleOverviewWheel(event) {
    if (!document.documentElement.classList.contains('overview')) return;

    if (event.ctrlKey) {
        // ── Pinch: zoom ───────────────────────────────────────────────────
        event.preventDefault();

        var delta = event.deltaY;
        if (event.deltaMode === 1) delta *= 15;
        if (event.deltaMode === 2) delta *= 300;

        var newScale = Math.max(0.2, Math.min(5.0, ovPinchScale * Math.pow(0.99, delta)));
        var R = newScale / ovPinchScale;
        ovPinchScale = newScale;

        var cx = event.clientX + window.scrollX;
        var cy = event.clientY + window.scrollY;
        ovPinchTx = cx * (1 - R) + ovPinchTx * R;
        ovPinchTy = cy * (1 - R) + ovPinchTy * R;

        applyOverviewTransform();

    } else {
        // ── Two-finger drag: pan ──────────────────────────────────────────
        // When no transform is active, let the browser handle normal page
        // scroll so the 1× overview grid remains scrollable as usual.
        if (ovPinchScale === 1.0 && ovPinchTx === 0 && ovPinchTy === 0) return;

        event.preventDefault();

        var dx = event.deltaX;
        var dy = event.deltaY;
        if (event.deltaMode === 1) { dx *= 15; dy *= 15; }
        if (event.deltaMode === 2) { dx *= 300; dy *= 300; }

        ovPinchTx -= dx;
        ovPinchTy -= dy;

        applyOverviewTransform();
    }
}

// ── end Overview zoom helpers ────────────────────────────────────────────────

// toggles overview mode (grid view of all slides)
function toggleOverview() {
    var root = document.documentElement;

    if (root.classList.contains("overview")) {
        // Exit overview mode — clear pinch transform before leaving
        resetOverviewTransform();
        root.classList.remove("overview");
        showSlide(currentSlideNum);
    } else {
        // Enter overview mode — always start with identity transform
        resetOverviewTransform();
        root.classList.add("overview");

        // Apply card size for current column count
        applyOverviewZoom();

        // Show zoom toolbar
        ensureOverviewToolbar();

        // Add click handlers to slides
        Array.from(document.getElementsByClassName("slide")).forEach(function (slide, index) {
            slide.onclick = function (e) {
                if (root.classList.contains("overview")) {
                    e.preventDefault();
                    e.stopPropagation();
                    resetOverviewTransform(); // clear pinch zoom before leaving overview
                    root.classList.remove("overview");
                    gotoSlide(index);
                }
            };
        });

        // Highlight current slide
        Array.from(document.getElementsByClassName("slide")).forEach(e => e.classList.remove("active"));
        var currentSlideEl = document.getElementById("slide" + currentSlideNum);
        currentSlideEl.classList.add("active");

        // Scroll to center the current slide in the viewport (instant, no animation)
        setTimeout(function () {
            currentSlideEl.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        }, 10);
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
        <div id="slide-number"><span class="current">${currentSlideNum}</span><span class="total">/${getNumberedSlideCount(slideCount)}</span></div>
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
        case 79:  // o
            toggleOverview();
            return false;
        case 187: // = / + (zoom in: fewer columns → bigger cards)
        case 61:  // = / + on some keyboards/Firefox
            if (document.documentElement.classList.contains('overview')) {
                if (overviewColumns > 2) {
                    overviewColumns--;
                    applyOverviewZoom();
                    updateOverviewToolbarState();
                }
                return false;
            }
            return;
        case 189: // - (zoom out: more columns → smaller cards)
        case 173: // - on Firefox
            if (document.documentElement.classList.contains('overview')) {
                if (overviewColumns < 10) {
                    overviewColumns++;
                    applyOverviewZoom();
                    updateOverviewToolbarState();
                }
                return false;
            }
            return;
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
// Wait for DOM to be fully loaded before setting event listeners
document.addEventListener('DOMContentLoaded', function () {
    document.body.onkeydown = keyPress;
    // Overview wheel handler (pinch-to-zoom + two-finger pan):
    // must be non-passive so we can call preventDefault when needed
    document.addEventListener('wheel', handleOverviewWheel, { passive: false });
});

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
document.body.onmousemove = function () {
    if (document.body.style.cursor != "none") {
        if (cursorTimeout) {
            clearTimeout(cursorTimeout);
        }
    } else {
        document.body.style.cursor = "auto";
    }

    cursorTimeout = setTimeout(function () {
        if (document.documentElement.classList.contains("draft")) {
            return;
        }

        document.body.style.cursor = "none";
    }, 2000);
};
