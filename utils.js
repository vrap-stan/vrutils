const fs = require("fs");
function getAllFilesInDir(dir, extensions = []) {
  const path = require("path");

  let files = [];

  const filesInDir = fs.readdirSync(dir);
  const lowerExtensions = extensions?.map((ext) => ext.toLowerCase()) ?? [];
  // console.log({lowerExtensions});

  filesInDir.forEach((file) => {
    if ([".DS_Store", "Thumbs.db"].includes(file)) {
      return;
    }
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // If it's a directory, recursively call the function
      files = files.concat(getAllFilesInDir(filePath, lowerExtensions));
    } else {
      if (lowerExtensions?.length > 0 && Array.isArray(lowerExtensions)) {
        const ext = path.extname(filePath);
        if (lowerExtensions.includes(ext.toLowerCase())) {
          files.push(filePath);
        }
      } else {
        files.push(filePath);
      }
    }
  });

  return files;
}

function getFileSize(filePath, unit = "kb") {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    if (unit === "bytes") {
      return fileSizeInBytes;
    }
    const fileSizeInKilobytes = fileSizeInBytes / 1024;
    if (unit === "kb") {
      return fileSizeInKilobytes;
    }
    const fileSizeInMegabytes = fileSizeInKilobytes / 1024;
    if (unit === "mb") {
      return fileSizeInMegabytes;
    }
    // console.log(`File Size in Bytes: ${fileSizeInBytes}`);
    // console.log(`File Size in Kilobytes: ${fileSizeInKilobytes}`);
    // console.log(`File Size in Megabytes: ${fileSizeInMegabytes}`);
  } catch (err) {
    console.error(`Error reading file stats: ${err}`);
    return null;
  }
}

function section(...args) {
  return console.log("========================================", ...args, "========================================");
};

module.exports = {
  getAllFilesInDir,
  getFileSize,
  section
};
