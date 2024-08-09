exports.init = (inputOptions) => {
  const fs = require("fs");
  const defaultOptions = inputOptions.defaultOptions;
  if (!fs.existsSync("vrutils.config.json")) {
    fs.writeFileSync(
      "vrutils.config.json",
      JSON.stringify(defaultOptions, null, 2)
    );
    console.log(" * vrutils 초기화 완료");
    console.log(
      " * 다음 파일에서 기본 옵션들을 확인할 수 있습니다 : ./vrutils.config.json"
    );
  }
};
