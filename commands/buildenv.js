exports.buildenv = function (inputOptions) {
  const fs = require("fs");
  const path = require("path");

  /// /////////////////////////////////////////////////////////////////////
  // 설명 - 하단의 Settings 부분을 수정한다. 이 스크립트는 npm run buildenv시에만 실행된다.
  //
  // 1. ENV_NAME = "DST_ENV"
  //    ENV_PUBLIC.DST_ENV를 호출하면 "development" | "preview" | "production" 중 하나가 반환된다. 사용하는 환경변수에 따라 "preview" 대신 "test"인 경우도 있음.
  //    * 주의 : 환경변수는 다음 우선순위로 호출된다.
  //      1. process.env.NEXT_PUBLIC_VRAP_ENV
  //      2. process.env.NEXT_PUBLIC_ENVIRONMENT
  //      3. process.env.NEXT_PUBLIC_VERCEL_ENV
  //      4. process.env.NODE_ENV
  //      IS_DEV  = DST_ENV === d | dev | development
  //      IS_QA   = DST_ENV === qa | test | preview
  //      IS_PROD = DST_ENV === p | prod | production
  // 2. publicFilePath = "./scripts/client/_ENV_PUBLIC.ts"
  //    생성될 ENV_PUBLIC.ts 파일의 경로를 지정
  //
  // 3. publicImportPath = "@/scripts/client/_ENV_PUBLIC"
  //    ENV_SERVER.ts에서 ENV_PUBLIC.ts를 import할 때 사용할 경로를 지정
  //
  // 4. privateFilePath = "./scripts/server/_ENV_SERVER.ts"
  //    생성될 ENV_SERVER.ts 파일의 경로를 지정

  /// /////////////////////////////////////////////////////////////////////
  // Settings

  const options = inputOptions.buildenv();

  const {
    ENV_NAME,
    ENV_ORDER,
    publicFileName,
    privateFileName,
    publicFileDirPath,
    publicImportDirPath,
    privateFileDirPath,
    searchThrough,
    createDirIfNotExist,
    devEnvs,
    qaEnvs,
    prodEnvs,
    initIgnorePrefix,
    overrideSuffix,
    envIgnore,
    envIgnoreStart,
    envIgnoreEnd,
    speakOnEnvIgnore,
    transpileOutDir,
  } = options;

  const publicFilePath = path.join(publicFileDirPath, publicFileName + ".ts");
  const privateFilePath = path.join(
    privateFileDirPath,
    privateFileName + ".ts"
  );
  const publicImportPath = path.join(publicImportDirPath, publicFileName);

  const envfile = searchThrough.reduce((acc, lookup) => {
    if (acc) {
      return acc;
    }
    return fs.existsSync(lookup) ? fs.readFileSync(lookup, "utf8") : null;
  }, null);
  if (!envfile) {
    console.error(
      `환경변수 파일을 찾을 수 없습니다. 다음 중 하나여야 합니다 : [ ${searchThrough.join(
        ", "
      )} ]`
    );
    process.exit(1);
  }

  /// /////////////////////////////////////////////////////////////////////
  // Code area

  const { publicMeta, privateMeta } = parseEnv();
  const publicFile = buildFileFromMeta(publicMeta, publicFileName);
  const privateFile = buildFileFromMeta(
    privateMeta,
    privateFileName,
    publicFileName
  );

  if (createDirIfNotExist) {
    // recursively
    const publicDir = publicFileDirPath;
    const privateDir = privateFileDirPath;
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }
  }

  fs.writeFileSync(publicFilePath, publicFile);
  fs.writeFileSync(privateFilePath, privateFile);

  console.log(">> [1] ENV 파일 생성 완료");
  console.log(`>> [2] - ${publicFilePath}`);
  console.log(`>> [3] - ${privateFilePath}`);

  /// /////////////////////////////////////////////////////////////////////
  // Function area

  function parseEnv() {
    let minimal = envfile
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const multilineFilter = (input) => {
      const startIdx = input.findIndex((line) => line.includes(envIgnoreStart));
      const endIdx = input.findIndex((line) => line.includes(envIgnoreEnd));
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        if (speakOnEnvIgnore) {
          console.log(
            `  - ${envIgnoreStart} ~ ${envIgnoreEnd}에 의해 무시됨 : `,
            input.slice(startIdx, endIdx + 1)
          );
        }
        return input.slice(0, startIdx).concat(input.slice(endIdx + 1));
      }
      return null;
    };
    while (true) {
      const filtered = multilineFilter(minimal);
      if (!filtered) {
        break;
      }
      minimal = filtered;
    }

    const lines = minimal
      .filter(
        (line) => !line.includes(envIgnoreStart) && !line.includes(envIgnoreEnd)
      )
      .filter((line, i, trimmedLines) => {
        const ignored = trimmedLines.at(i - 1)?.includes(envIgnore);
        if (ignored && speakOnEnvIgnore) {
          console.log(`  - ${envIgnore}에 의해 무시됨 : `, line);
        }
        return !ignored;
      })
      .filter((line) => !line.startsWith("#"))
      .filter((line) => !line.startsWith("_"))
      .filter((line) => !line.startsWith("@"))
      .filter((line) => line.includes("="))
      .filter((line) => line.split("=").length > 1)
      .reduce(
        (obj, line) => ({
          ...obj,
          [line.split("=")[0].trim().toUpperCase()]: line
            .split("=")
            .slice(1)
            .join("")
            .trim(),
        }),
        {}
      );

    const publics = Object.keys(lines).filter((key) =>
      key.startsWith("NEXT_PUBLIC_")
    );
    const privates = Object.keys(lines).filter(
      (key) => !key.startsWith("NEXT_PUBLIC_")
    );

    const parseMeta = (keys) => {
      const prefixFilter = (prefix) =>
        keys.filter((key) => key.startsWith(prefix));
      const suffixFilter = (suffix) =>
        keys.filter((key) => key.endsWith(suffix));

      const devs = suffixFilter("_DEV");
      const qas = suffixFilter("_QA");
      const prods = suffixFilter("_PROD");
      const commons = keys.filter((key) => {
        return (
          !key.endsWith(overrideSuffix) &&
          !key.endsWith("_DEV") &&
          !key.endsWith("_QA") &&
          !key.endsWith("_PROD")
        );
      });

      // 1. Length comparison
      if (devs.length !== qas.length || qas.length !== prods.length) {
        console.error(
          "Number of DEV, QA, and PROD variables must be the same",
          {
            devs,
            qas,
            prods,
          }
        );
        process.exit(1);
      }

      // 2. Check if each has same suffix;
      const devKeys = devs.map((key) => key.replace("_DEV", ""));
      const qaKeys = qas.map((key) => key.replace("_QA", ""));
      const prodKeys = prods.map((key) => key.replace("_PROD", ""));
      if (
        !devKeys.every((key) => qaKeys.includes(key)) ||
        !devKeys.every((key) => prodKeys.includes(key))
      ) {
        console.error("DEV, QA, and PROD variables must have the same suffix");
        console.error({ devKeys, qaKeys, prodKeys });
        process.exit(1);
      }
      const forkedKeys = [...devKeys];

      // 3. Check if _OVERRIDE exists
      const overrides = suffixFilter(overrideSuffix);
      const overridesVerified = overrides
        .map((key) => key.replace(overrideSuffix, ""))
        .every((key) => [...commons, ...forkedKeys].includes(key));
      if (!overridesVerified) {
        throw new Error(
          `_OVERRIDE destination not found. Overrides : ${overrides.join(", ")}`
        );
      }

      return {
        overrides,
        commons,
        forkedKeys,
      };
    };

    const publicMeta = parseMeta(publics);
    const privateMeta = parseMeta(privates);

    return { publicMeta, privateMeta };
  }

  function buildFileFromMeta(meta, className, parentClassName = null) {
    const commonVariableArea = "<<COMMON_VARIABLE_AREA>>";
    const forkedVariableArea = "<<FORKED_VARIABLE_AREA>>";
    const initMethodArea = "<<METHOD_AREA>>";
    const is_init = `static is_${className}_init = false;`;
    const init_method_name = `init_${className}`;
    const parent_init_method_name = `init_${parentClassName}`;

    const classEnv = `${className}.${ENV_NAME}`;
    let fileTemplate = `
/* DO NOT EDIT! THIS IS AUTO-GENERATED FILE */
${parentClassName ? `import ${parentClassName} from "${publicImportPath}"` : ""}
export default class ${className}${
      parentClassName ? ` extends ${parentClassName}` : ""
    } {
  ${
    parentClassName
      ? ""
      : `////////////////////////////////////////////////////////////////////////
  // ENV Area
  static ${ENV_NAME} =
    (${ENV_ORDER.map((key) => `process.env.${key}`).join(
      " ?? \n\t\t\t"
    )}) as string;
  static IS_DEV = ([${devEnvs
    .map((word) => `"${word}"`)
    .join(",")}].includes(\n\t\t\t\t\t${classEnv}?.toLowerCase())) as boolean;
  static IS_QA = ([${qaEnvs
    .map((word) => `"${word}"`)
    .join(",")}].includes(\n\t\t\t\t\t${classEnv}?.toLowerCase())) as boolean;
  static IS_PROD = ([${prodEnvs
    .map((word) => `"${word}"`)
    .join(",")}].includes(\n\t\t\t\t\t${classEnv}?.toLowerCase())) as boolean;\n
  static IS_DEV_OR_QA = ${className}.IS_DEV || ${className}.IS_QA as boolean;`
  }
  ////////////////////////////////////////////////////////////////////////
  // Common Area
  ${commonVariableArea}
  ////////////////////////////////////////////////////////////////////////
  // Forked Area
  ${forkedVariableArea}
  ////////////////////////////////////////////////////////////////////////
  // Init Area
  ${is_init}
  static ${init_method_name} = () => {
    ${parentClassName ? `${className}.${parent_init_method_name}();` : ""}
    ${initMethodArea}
  }
}
${className}.${init_method_name}();
`;

    const { overrides, commons, forkedKeys } = meta;

    const commonVars = buildCommonVariables(commons);
    const forkedVars = buildForkedVariables(
      forkedKeys,
      parentClassName ?? className
    );
    const initMethod = buildInitMethod([...commons, ...forkedKeys], className);
    fileTemplate = fileTemplate.replace(commonVariableArea, commonVars);
    fileTemplate = fileTemplate.replace(forkedVariableArea, forkedVars);
    fileTemplate = fileTemplate.replace(initMethodArea, initMethod);

    // console.log({ fileTemplate });

    return fileTemplate;
  }

  function buildForkedVariables(keys, className) {
    return keys
      .map((key) => {
        return `static ${key} =
    (process.env.${key}${overrideSuffix} ?? (
      (${className}.IS_DEV ) ? process.env.${key}_DEV :
      (${className}.IS_QA  ) ? process.env.${key}_QA :
      (${className}.IS_PROD) ? process.env.${key}_PROD :
      null
    )) as string;\n`;
      })
      .join("\n\t\t");
  }

  function buildCommonVariables(forked) {
    return forked
      .map((key) => {
        return `\n\tstatic ${key} = \n\t\t\t\t\t\t(process.env.${key}${overrideSuffix} ??\n\t\t\t\t\t\tprocess.env.${key}) as string;`;
      })
      .join("\n\t\t");
  }

  function buildInitMethod(keys, className) {
    const is_init = `${className}.is_${className}_init`;
    return `
      if (${is_init}) {
        return;
      }
      if (!(${className}.IS_DEV || ${className}.IS_PROD || ${className}.IS_QA)) {
        throw new Error("Invalid NODE_ENV: " + ${className}.${ENV_NAME});
      }
    
      const variables = {
        IS_DEV: ${className}.IS_DEV,
        IS_PROD: ${className}.IS_PROD,
        IS_QA: ${className}.IS_QA,
        IS_DEV_OR_QA: ${className}.IS_DEV_OR_QA,
        ${keys.map((key) => `${key} : ${className}.${key}`).join(",\n\t\t\t\t")}
      };
      const isNullish = (val: string) =>
        val === undefined ||
        val === null ||
        val?.length === 0;
    
      const missing = Object.keys(variables).filter((key) => isNullish(variables[key])).filter((key) => !key.toLowerCase().startsWith("${initIgnorePrefix.toLowerCase()}"));
    
      if (missing.length > 0) {
        throw new Error(".env.local에 환경변수를 추가해주세요 : " + missing.join(", "));
      }
      ${is_init} = true;
  `;
  }

  /// /////////////////////////////////////////////////////////////////////
  // Transpile

  if (inputOptions.args.includes("transpile")) {
    console.log("Trasnpile to JS start");
    const esbuild = require("esbuild");
    const dstDir = transpileOutDir ?? "./_ENV";

    esbuild
      .build({
        entryPoints: [publicFilePath],
        bundle: true,
        platform: "node",
        target: "node14",
        outdir: dstDir,
      })
      .then(() => {
        console.log(
          ` - transpiled to : [ ${path.join(dstDir, publicFileName)} ]`
        );
        esbuild
          .build({
            entryPoints: [privateFilePath],
            bundle: true,
            platform: "node",
            target: "node14",
            outdir: dstDir,
          })
          .then(() => {
            console.log(
              ` - transpiled to : [ ${path.join(dstDir, privateFileName)} ]`
            );
            console.log("Transpile to JS complete");
          });
      });
  }
};
