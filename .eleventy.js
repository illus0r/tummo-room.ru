module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets/img");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("CNAME");

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
};
