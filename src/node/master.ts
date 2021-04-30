import shell from "shelljs";
import { join } from "path";
import { access, constants } from "fs";
import { logger } from "../util/logger";

// promisify
const CheckFileExist = (path: string) => {
  return new Promise((resolve, reject) => {
    access(path, constants.R_OK, (err) => {
      if (err) {
        logger(`Unreadable file ${path}`, "error");
        reject(err);
      } else resolve(true);
    });
  });
};

export const SplitFile = async (file: Express.Multer.File) => {
  logger(`${file.originalname} received => ${file.filename}`, "info");

  const CHUNK_SIZE = 1; // In megabytes

  try {
    // Make sure file has written into storage
    await CheckFileExist(file.path);

    // Splitting file into chunks is done by split.sh
    logger(`${file.filename}: split job started`);
    shell.exec(
      `bash ${join(__dirname, "split.sh")} ${file.path} ${file.destination}/${
        file.filename
      } ${CHUNK_SIZE}`,
      { async: true },
      (code, stdout, stderr) => {
        if (code === 0) {
          logger(`${file.filename}: split job finished`, "success");
        } else {
          logger(`${file.filename}: Non-zeor exit`, "error");
          logger(`${file.filename}: code ${code}`);
          logger(`${file.filename}: stdout ${stdout}`);
          logger(`${file.filename}: stderr ${stderr}`);
        }

        // Delete the original file
        shell.rm(file.path);
      }
    );

    // Delte the original file
  } catch (error) {
    logger(error, "error");
  }
};
