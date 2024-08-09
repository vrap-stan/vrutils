const fs = require("fs");
const path = require("path");
const { section } = require("../utils.js");
const optimizeSingleLocale = (option) => {
  const {
    locale,
    directoryPaths,
    fileExtensions,
    excludeOptimization,
    writeOptimizedStrings,
    verbose,
  } = option;
  const localePath = `public/locales/${locale}/common.json`;
  const originalLocale = JSON.parse(fs.readFileSync(localePath, "utf8"));
  if (!originalLocale) {
    console.log("로케일 파일 없음. 경로 : " + localePath);
    return false;
  }
  const originalSize = fs.statSync(localePath).size;

  function findFilesWithExtensions(dirPaths, extensions) {
    const files = [];

    function scanDirectory(currentPath) {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          scanDirectory(itemPath);
        } else if (extensions.includes(path.extname(item))) {
          files.push(itemPath);
        }
      }
    }

    for (const dirPath of dirPaths) {
      if (!fs.existsSync(dirPath)) {
        if (verbose) {
          console.log(" - 폴더가 존재하지 않아 스킵 : " + dirPath);
        }
        continue;
      }
      scanDirectory(dirPath);
    }

    return files;
  }

  const tsFiles = findFilesWithExtensions(directoryPaths, fileExtensions);
  if (tsFiles.length === 0) {
    if (verbose) {
      console.log("파일이 없습니다. 경로 : ", directoryPaths.join(", "));
    }
    return false;
  }
  const filemap = {};
  tsFiles.forEach((filePath) => {
    filemap[filePath] = fs.readFileSync(path.resolve(filePath), "utf8");
  });

  const dynamicStrings = {
    prefix: [],
    suffix: [],
  };

  const removeTrailingDollarSign = (str) => {
    if (str.endsWith("$")) {
      return str.slice(0, -1);
    }
    return str;
  };

  const findDynamicStrings = () => {
    tsFiles.filter((filePath) => {
      if (filemap[filePath] === null || filemap[filePath] === undefined) {
        throw new Error("파일이 로드되지 않음 : " + filePath);
      }
      const fileContent = filemap[filePath];
      fileContent.split("\n").forEach((line) => {
        const regex =
          /(?<!\b(?:visi|aler|ge|spli))t\(['"`][^){}]*\{[^)}]*\}[^)]*['"`]\)/g;
        const matches = line.match(regex);
        if (matches) {
          const captureRegex =
            /(?<!\b(?:visi|aler|ge|spli))t\(['"`]([^){}]*)\{[^)}]*\}([^)]*)['"`]\)/g;
          const captured = captureRegex.exec(line);
          if (captured) {
            dynamicStrings.prefix.push(removeTrailingDollarSign(captured[1]));
            if (captured[2].trim().length > 0) {
              dynamicStrings.suffix.push(captured[2].trim());
            }
          } else {
            throw new Error(
              "Failed to capture on line : " + line + " of file :" + filePath
            );
          }
        }
      });
    });
    dynamicStrings.prefix = Array.from(new Set(dynamicStrings.prefix));
    dynamicStrings.suffix = Array.from(new Set(dynamicStrings.suffix));
    if (dynamicStrings.prefix.length + dynamicStrings.suffix.length > 0) {
      console.log("* 동적으로 빌드되는 스트링 : ");
      if (dynamicStrings.prefix.length) {
        console.log("  prefix : ", dynamicStrings.prefix.join(", "));
      }
      if (dynamicStrings.suffix.length) {
        console.log("  suffix : ", dynamicStrings.suffix.join(", "));
      }
    }
  };

  findDynamicStrings();

  const excludeOptimizationMerged = {
    prefix: [...excludeOptimization?.prefix, ...dynamicStrings.prefix],
    suffix: [...excludeOptimization?.suffix, ...dynamicStrings.suffix],
  };

  function findPatternInFile(filePath, pattern) {
    if (filemap[filePath] === null || filemap[filePath] === undefined) {
      throw new Error("파일이 로드되지 않음 : " + filePath);
    }
    const fileContent = filemap[filePath];
    return pattern.test(fileContent);
  }

  const stringUsed = (str) => {
    const actualStringVariable = str;
    const escapedStringVariable = actualStringVariable.replace(
      /[-\/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

    const regexPattern = new RegExp(
      `t\\(['"\`]${escapedStringVariable}['"\`]\\)`
    );

    const filesWithPattern = tsFiles.filter((filePath) =>
      findPatternInFile(filePath, regexPattern)
    );

    return filesWithPattern.length > 0;
  };

  const findAllUnused = () => {
    const localeKeys = Object.keys(originalLocale);
    const start = new Date().getTime();
    const total = localeKeys.length;
    const unusedStrings = localeKeys.filter((key, i) => {
      if (verbose && i % 100 === 0) {
        console.log(`${i + 1}/${total}...`);
      }
      return !stringUsed(key);
    });
    const elapsed = new Date().getTime() - start;
    if (verbose) {
      console.log(`Elapsed: ${elapsed}ms`);
    }

    if (writeOptimizedStrings) {
      if (typeof writeOptimizedStrings !== "string") {
        console.log("writeOptimizedStrings 옵션은 문자열이어야 합니다.");
      } else {
        const listPath = `${writeOptimizedStrings}`;
        const directoryPath = path.dirname(listPath);
        if (!fs.existsSync(directoryPath)) {
          fs.mkdirSync(directoryPath, { recursive: true });
        }
        fs.writeFileSync(listPath, unusedStrings.join("\n"));
        if (verbose) {
          console.log(
            "사용되지 않은 스트링 갯수 : ",
            unusedStrings.length,
            "개가 다음 파일에 저장되었습니다. : ",
            listPath
          );
        }
      }
    }

    unusedStrings.forEach((key) => {
      const skipPrefix = excludeOptimizationMerged.prefix.some((prefix) =>
        key.startsWith(prefix)
      );
      const skipSuffix = excludeOptimizationMerged.suffix.some((suffix) =>
        key.endsWith(suffix)
      );
      if (skipPrefix || skipSuffix) {
        console.log(`  - ${key}는 최적화로부터 제외됨`);
        return;
      }

      delete originalLocale[key];
    });

    fs.writeFileSync(localePath, JSON.stringify(originalLocale, null, 0));
    const newSize = fs.statSync(localePath).size;
    if (verbose) {
      console.log(`최초 용량: ${Math.round(originalSize / 1024)} kb`);
      console.log(`압축된 용량: ${Math.round(newSize / 1024)} kb`);
      console.log(` - 차이: ${Math.round((originalSize - newSize) / 1024)} kb`);
    }
  };
  findAllUnused();
  return true;
};

exports.compressLocale = function (inputOptions) {
  const options = inputOptions.options.compressLocale;
  const locales = Object.keys(options);

  if (locales?.length > 0) {
    let results = false;
    locales.forEach((locale) => {
      section("로케일 파일 최적화 : ", locale);
      results |= optimizeSingleLocale({
        locale,
        ...options[locale],
      });
    });

    if (results) {
      section("로케일 파일 최적화 완료");
    } else {
      section("로케일 파일 최적화 실패");
    }
  } else {
    section("최적화할 로케일이 없음");
  }
};
