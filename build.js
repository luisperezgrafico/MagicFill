// build.js
const fs = require("fs");

// Read the contents of the styles.css file
const cssContent = fs.readFileSync("styles.css", "utf-8");

// Wrap the CSS content in a <style> tag
const styleTag = `<style>\n${cssContent}\n</style>`;

// Read the index.html file
const htmlContent = fs.readFileSync("index.html", "utf-8");

// Inject the <style> tag into the <head> of the index.html file
const updatedHtmlContent = htmlContent.replace("</head>", `${styleTag}\n</head>`);

// Save the updated index.html file
fs.writeFileSync("dist/index.html", updatedHtmlContent);
