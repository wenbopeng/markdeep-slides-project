document.write(`
<!-- Markdeep slides stuff -->
<script>
markdeepSlidesOptions= {
    aspectRatio: 16 / 10,
    theme: "https://obsidian-weber.oss-cn-hangzhou.aliyuncs.com/share/markdeep/markdeep-slides/themes/simple.css",
    fontSize: 28,
    diagramZoom: 1.0,
    totalSlideNumber: true,
    progressBar: true,
    breakOnHeadings: true,
    incrementalFlat: false,
    slideChangeHook: (oldSlide, newSlide) => {},
    modeChangeHook: (newMode) => {}
};
</script>
<link rel="stylesheet" href="https://obsidian-weber.oss-cn-hangzhou.aliyuncs.com/share/markdeep/markdeep-slides/lib/markdeep-relative-sizes/1.11/relativize.css">
<link rel="stylesheet" href="https://obsidian-weber.oss-cn-hangzhou.aliyuncs.com/share/markdeep/markdeep-slides/markdeep-slides.css">
<script src="https://obsidian-weber.oss-cn-hangzhou.aliyuncs.com/share/markdeep/markdeep-slides/markdeep-slides.js"></script>

<script>
    markdeepOptions = {
        tocStyle: 'none',
        detectMath: false,
        onLoad: function() {
            initSlides();
        }
    };
</script>
<style class="fallback">body{visibility:hidden;white-space:pre;font-family:monospace}</style>
<script src="https://obsidian-weber.oss-cn-hangzhou.aliyuncs.com/share/markdeep/markdeep-slides/lib/markdeep/1.11/markdeep.min.js" charset="utf-8"></script>
<script>window.alreadyProcessedMarkdeep||(document.body.style.visibility="visible")</script>
`);