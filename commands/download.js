exports.download = (options) => {
  let { url, outPath } = options.download();
  const parseArgs = (dstArg) => {
    const finder = `${dstArg}=`;
    const starter = options.args?.find((arg) => arg.startsWith(finder));
    return starter?.split(`${dstArg}=`)?.slice(1).join();
  };

  const parsedUrl = parseArgs("url");
  const parsedOutPath = parseArgs("outPath") || parseArgs("outpath");
  if (parsedUrl) {
    console.log("Url 커맨드 입력 : ", parsedUrl);
  }
  if (parsedOutPath) {
    console.log("OutPath 커맨드 입력 : ", parsedOutPath);
  }
  url = parsedUrl || url;
  outPath = parsedOutPath || outPath;

  if (!url || !outPath) {
    throw new Error(
      `\n* 입력된 url:[${url}] outPath:[${outPath}]\n* vrutils.config.json에 url과 outPath를 정의해주세요.\n* 또는 다음과 같이 실행해주세요 :\n* vrutils download url=http://url.com outpath=download/file.html`
    );
  }
  const protocol = url.startsWith("https") ? require("https") : require("http");
  const fs = require("fs");
  const file = fs.createWriteStream(outPath);
  const request = protocol
    .get(url, function (response) {
      response.pipe(file);
      file.on("finish", function () {
        file.close();
        console.log(
          `다운로드 완료.
  - 저장 경로 : [${outPath}]
  - url : [${url}]`
        );
      });
    })
    .on("error", function (err) {
      fs.unlink(outPath);
      throw err;
    });
};
