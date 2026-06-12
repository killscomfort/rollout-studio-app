const path = require("node:path");
const { build } = require("electron-builder");

const projectRoot = path.join(__dirname, "..");

build({
  projectDir: projectRoot,
  mac: ["dir"],
})
  .then(() => {
    console.log("Pack complete.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
