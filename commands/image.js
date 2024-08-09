const { cwd } = require("process");

exports.image = async (options) => {
  const start = Date.now();

  const fs = require("fs");
  const path = require("path");
  const { getAllFilesInDir, getFileSize, section } = require("../utils");

  section("[ 이미지 최적화 ]");

  const {
    src,
    dst,
    toWebp,
    quality,
    custom,
    webpListPath,
    showTopSize,
    topSizeListPath,
  } = options.options.image;

  const saveWebpList =
    toWebp?.length > 0 &&
    webpListPath &&
    typeof webpListPath === "string" &&
    webpListPath?.length > 0;

  // intro
  console.log("  - 소스 이미지폴더 경로 : ", src);
  console.log("  - 저장할 이미지폴더 경로 : ", dst);
  console.log("  - WebP로 변환할 이미지 확장자 : ", toWebp);
  console.log("  - 이미지 퀄리티 : ", quality);
  console.log("  - 커스텀 파일 : ", Object.keys(custom ?? {}).length, "개");
  console.log(
    "  - WebP 파일 리스트 저장 : ",
    saveWebpList ? webpListPath : "X"
  );
  console.log("  - 용량 제일 큰 파일 : ", showTopSize ?? 0 + "개 출력");

  if (!fs.existsSync(src)) {
    // throw new Error("src 경로가 존재하지 않습니다. src:" + src);
    console.error("src 경로가 존재하지 않습니다. src:" + src);
    return;
  }

  // default extensions :
  // [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]
  // const lowerExtension = ["ds_store"];
  // const lowerExtension = [];
  const fileList = getAllFilesInDir(src);
  if (fileList.length === 0) {
    console.log("파일이 없습니다. 경로나 확장자를 확인해주세요.");
    console.log(" - 검색경로 (options.image.src) : ", src);
  }
  const exts = [
    ...new Set(fileList.map((file) => path.extname(file.toLowerCase()))),
  ];

  section("[ 시작 ]");
  // 파일이 있으면 준비작업
  console.log("  - 이미지 : ", fileList.length, "개");
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
    console.log("  - 폴더 생성 : ", dst);
  }
  const sharp = require("sharp");

  const webpOption = {
    quality: quality ?? 80,
    effort: 0,
  };
  const pngOption = {
    quality: quality ?? 80,
    compressionLevel: 9,
    // effort: 1,
  };
  const jpgOption = {
    quality: quality ?? 80,
  };
  // const buffers = await Promise.all(fileList.map(file=>sharp(file).towebp(webpOption).toBuffer()));
  //   const toWebp = [".png", ".jpg", ".jpeg", ".gif"];

  const toNonNullObj = (obj) => obj ?? {};
  const converters = {
    ".webp": (file, filePath, option) =>
      sharp(file)
        .webp({ ...webpOption, ...toNonNullObj(option) })
        .toFile(filePath),
    ".png": (file, filePath, option) =>
      sharp(file)
        .png({ ...pngOption, ...toNonNullObj(option) })
        .toFile(filePath),
    ".jpg": (file, filePath, option) =>
      sharp(file)
        .jpeg({ ...jpgOption, ...toNonNullObj(option) })
        .toFile(filePath),
    ".jpeg": (file, filePath, option) =>
      sharp(file)
        .jpeg({ ...jpgOption, ...toNonNullObj(option) })
        .toFile(filePath),
  };
  converters.png = converters[".png"];
  converters.jpg = converters[".jpg"];
  converters.jpeg = converters[".jpeg"];
  converters.webp = converters[".webp"];

  // 통계용, 저장 시 { src:경로, dst:경로 } 형태로 저장
  const converted = [];
  const webpConverted = [];
  let compressedCount = 0;
  let uncompressedCount = 0;

  // case 1. custom
  const customFileNames = Object.keys(custom ?? {});
  const customFilesFound = [];
  const nonCustomFilesFound = [];
  fileList.forEach((file) => {
    const found = customFileNames.find((customFile) =>
      file.includes(customFile)
    );
    if (found) {
      customFilesFound.push([file, found]);
    } else {
      nonCustomFilesFound.push(file);
    }
  });
  console.log("Custom : ", customFilesFound.length, "개");
  console.log("Non-Custom : ", nonCustomFilesFound.length, "개");

  await Promise.all(
    customFilesFound.map(async ([file, found]) => {
      // file:{ [원본파일명] : custom에서 지정한 파일명 };
      const keep = path.resolve(file);
      const customOption = custom[found];
      if (!customOption) {
        throw found;
      }
      let extension = (customOption.format ?? path.extname(file)).toLowerCase();
      if (!extension.startsWith(".")) {
        extension = "." + extension;
      }
      const filePath = path
        .join(dst, file);
      const directory = path.dirname(filePath);
      fs.mkdirSync(directory, { recursive: true });
      const converter = converters[extension];
      if (converter) {
        await converter(file, filePath, customOption);
        // await sharp(file).png({
        //     quality:10,
        // }).toFile(filePath);
        console.log(
          " - Custom : ",
          file,
          ` [ ${Math.round(getFileSize(keep))}kb => ${Math.round(
            getFileSize(filePath)
          )}kb (${Math.round(
            (getFileSize(filePath) / getFileSize(keep)) * 100
          )}%) ] saved to [ ${filePath} ]`
        );
        compressedCount++;
      } else {
        fs.copyFileSync(keep, filePath);
        uncompressedCount++;
      }
      converted.push({
        src: keep,
        dst: path.resolve(filePath),
      });
    })
  );

  // case 2. custom으로 지정되지 않은 파일들
  // { src:string, dst:string; }[];
  const files = exts.reduce((acc, ext) => {
    acc[ext] = nonCustomFilesFound.filter(
      (file) => path.extname(file.toLowerCase()) === ext
    );
    return acc;
  }, {});

  await Promise.all(
    Object.entries(files).map(async ([ext, fileList]) => {
      // toWebp = [".png", ".jpg", ".jpeg", ".gif"];
      if (toWebp?.includes(ext)) {
        return Promise.all(
          fileList.map(async (file) => {
            const keep = path.resolve(file);
            // const extensionChangedToWebp = file.replace(
            //   path.extname(file),
            //   ".webp"
            // );
            // png -> webp로 포맷은 바뀌더라도 파일 확장자는 png로 유지
            const extensionChangedToWebp = file;
            const filePath = path.join(dst, extensionChangedToWebp);
            const directory = path.dirname(filePath);
            fs.mkdirSync(directory, { recursive: true });

            // 1. WebP로 변환
            await sharp(file).webp(webpOption).toFile(filePath);

            const srcSize = getFileSize(keep);
            const dstSize = getFileSize(filePath);
            if (dstSize > srcSize) {
              // 2. 원본보다 용량이 크면 원본으로 복원
              fs.unlinkSync(filePath);
              const filePathWithOriginalExtension = path.join(dst, file);
              fs.copyFileSync(keep, filePathWithOriginalExtension);
              converted.push({
                src: keep,
                dst: path.resolve(filePathWithOriginalExtension),
              });
              uncompressedCount++;
            } else {
              converted.push({
                src: keep,
                dst: path.resolve(filePath),
              });
              compressedCount++;
              webpConverted.push(filePath);
            }
          })
        );
      } else {
        // just copy
        return Promise.all(
          fileList.map(async (file) => {
            const keep = path.resolve(file);
            const filePath = path.join(dst, file);
            const directory = path.dirname(filePath);
            fs.mkdirSync(directory, { recursive: true });

            const converter = converters[ext];
            if (converter) {
              // png, jpg, jpeg의 경우 퀄리티를 낮춰서 저장
              await converter(file, filePath);

              // 파일 사이즈 비교
              const srcSize = getFileSize(keep);
              const dstSize = getFileSize(filePath);
              if (dstSize > srcSize) {
                // 원본보다 용량이 크면 원본으로 복원
                fs.unlinkSync(filePath);
                fs.copyFileSync(keep, filePath);
                uncompressedCount++;
              } else {
                compressedCount++;
              }
            } else {
              fs.copyFileSync(keep, filePath);
              uncompressedCount++;
            }

            converted.push({
              src: path.resolve(file),
              dst: path.resolve(filePath),
            });
          })
        );
      }
    })
  );

  const maxNsizes = [];

  const sizes = converted.reduce(
    (acc, { src, dst }, i) => {
      const srcSize = getFileSize(src);
      const dstSize = getFileSize(dst);
      // console.log({src,dst})
      const ratio = Math.round((dstSize / srcSize) * 100);
      //   console.log(
      //     `[${Math.round(srcSize)} kb] -> [${Math.round(
      //       dstSize
      //     )} kb] (${ratio}%) : ${src} -> ${dst}`
      //   );
      if (maxNsizes.length < (showTopSize ?? 0)) {
        maxNsizes.push({
          src,
          dst,
          srcSize,
          dstSize,
          ratio,
        });
      } else {
        maxNsizes.sort((a, b) => b.srcSize - a.srcSize);
        if (maxNsizes.at(-1).srcSize < srcSize) {
          maxNsizes[maxNsizes.length - 1] = {
            src,
            dst,
            srcSize,
            dstSize,
            ratio,
          };
        }
      }
      acc.src = acc.src + srcSize;
      acc.dst = acc.dst + dstSize;
      return acc;
    },
    {
      src: 0,
      dst: 0,
    }
  );
  //   console.log({ sizes });
  const srcSizeMb = Math.round(sizes.src / 1024);
  const dstSizeMb = Math.round(sizes.dst / 1024);
  const compressPercent = Math.round((sizes.dst / sizes.src) * 100);

  if (maxNsizes.length > 0) {
    maxNsizes.sort((a, b) => b.srcSize - a.srcSize);
    section(`[ 용량 Top ${showTopSize} ]`);
    const msgs = [];
    maxNsizes.forEach((size, i) => {
      const msg = `[${i + 1}] ${path.basename(size.src)} [${Math.round(
        size.srcSize
      )} kb -> ${Math.round(size.dstSize)} kb (${
        size.ratio
      }%)] : ${path.relative(cwd(), size.src)} -> ${path.relative(
        cwd(),
        size.dst
      )}`;
      console.log(msg);
      msgs.push(msg);
    });
    if (topSizeListPath) {
      fs.writeFileSync(topSizeListPath, msgs.join("\n"));
      console.log(
        `  - 용량 Top ${showTopSize} 리스트 저장 : ${topSizeListPath}`
      );
    }
    console.log("");
  }

  const elapsed = Date.now() - start;
  console.log(
    `작업 완료. 총 파일 : [ ${
      converted.length
    }개 ] 압축됨 : [ ${compressedCount}개 ] 원본복사 : [ ${uncompressedCount}개 ] 압축률 = [ ${dstSizeMb}mb / ${srcSizeMb}mb = ${compressPercent}% ] 소요시간 : ${Math.round(
      elapsed / 1000
    )}초`
  );
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
  const nonImages = converted.filter(
    (file) => !imageExtensions.includes(path.extname(file.dst.toLowerCase()))
  );
  console.log("이미지가 아닌 파일 갯수 : ", nonImages.length);

  if (
    webpListPath &&
    typeof webpListPath === "string" &&
    webpListPath?.length > 0
  ) {
    const webpList = webpConverted;
    const webpListPath = "./webpList.txt";
    fs.writeFileSync(webpListPath, webpList.join("\n"));
    console.log(`WebP 파일 리스트 저장 : ${webpListPath}`);
  }
  section("[ 이미지 최적화 종료 ]");
};
