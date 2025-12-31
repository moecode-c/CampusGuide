
try {
    const pdf = require("pdf-parse");
    console.log("PDF Parse required successfully:", typeof pdf);
} catch (e) {
    console.error("Failed to require pdf-parse:", e);
    process.exit(1);
}
