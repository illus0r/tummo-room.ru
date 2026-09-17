const Typograf = require("typograf");

// типографика при сборке: неразрывные пробелы после предлогов и союзов, тире, кавычки
const typograf = new Typograf({ locale: ["ru", "en-US"] });

module.exports = function (eleventyConfig) {
  // исходники из «для сайта» (сотни МБ) на сайт не копируем
  eleventyConfig.addPassthroughCopy("src/assets/img/*.{webp,svg}");
  eleventyConfig.addPassthroughCopy("src/assets/img/bg");
  eleventyConfig.addPassthroughCopy("src/assets/img/photos");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/floors.css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy("CNAME");

  eleventyConfig.addTransform("typograf", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    // ₽ типограф не привязывает к числу — делаем это сами
    return typograf.execute(content).replace(/(\d)\s+₽/g, "$1\u00a0₽");
  });

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
