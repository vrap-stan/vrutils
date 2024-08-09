const fs = require("fs");
const path = require("path");
const findup = require("findup-sync");
const readJSON = (path) =>
  path ? JSON.parse(fs.readFileSync(path, "utf-8")) : null;
const optionFile = readJSON(findup("vrutils.config.json"));
const defaultOptions = readJSON(path.join(__dirname, "defaultOptions.json"));
const optionKeys = Object.keys(defaultOptions);
if (optionFile) {
  Object.keys(optionFile).forEach((key) => {
    if (!optionKeys.includes(key)) {
      const errorMsg =
        "지원하지 않는 옵션 : " +
        key +
        "\n가능한 옵션 : " +
        optionKeys.join(", ");
      console.error(errorMsg);
      //   throw new Error("지원하지 않는 옵션");
      process.exit(1);
    }
  });
} else {
  console.warn(" * vrutils.config.json 없음. 기본값으로 진행");
}
const options = optionKeys.reduce((acc, key) => {
  if (optionFile?.[key] !== undefined) {
    acc[key] = optionFile[key];
  }
  return acc;
}, defaultOptions);

exports.OptionBuilder = class OptionBuilder {
  defaultOptions = defaultOptions;
  constructor(args) {
    this.args = args;
    this.options = options;
  }
  speak() {
    console.log({ args: this.args, options: this.options });
  }
  buildenv() {
    return this.options.buildenv;
  }
  copystring() {
    return this.options.copystring;
  }
  parseurl() {
    return this.options.parseurl;
  }
  download() {
    return this.options.download;
  }
};
