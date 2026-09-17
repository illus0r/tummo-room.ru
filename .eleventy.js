module.exports = function (eleventyConfig) {
  // исходники из «для сайта» (сотни МБ) на сайт не копируем
  eleventyConfig.addPassthroughCopy("src/assets/img/*.{webp,svg}");
  eleventyConfig.addPassthroughCopy("src/assets/img/my-ceramics");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy("CNAME");

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
