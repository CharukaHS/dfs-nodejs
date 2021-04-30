import { logger } from "../util/logger";
import { CheckFileExist, RemoveOriginal } from "./common/fs";
import { AddNewFileToDB } from "./common/nedb";
import { RunSplitShell } from "./common/shell";

export const SplitFile = async (file: Express.Multer.File) => {
  logger(`${file.originalname} received => ${file.filename}`, "info");

  const CHUNK_SIZE = 1; // In megabytes

  try {
    // Make sure file has written into storage
    await CheckFileExist(file.path);

    // Splitting file into chunks is done by split.sh
    logger(`${file.filename}: split job started`);
    await RunSplitShell(file, CHUNK_SIZE);

    // Update master database
    await AddNewFileToDB(file);
  } catch (error) {
    logger(error, "error");
  }
};
