import shell from "shelljs";
import { join } from "path";
import { logger } from "../../util/logger";

export const RunSplitShell = (file: Express.Multer.File, size: number) => {
  return new Promise((resolve, reject) => {
    const bash_path = join(__dirname, "split.sh");
    const destination = join(
      file.destination,
      process.pid.toString(),
      file.filename
    );

    // create new folder to store chunks
    shell.mkdir("-p", destination);

    shell.exec(
      `bash ${bash_path} ${file.path} ${destination}/${file.filename}- ${size}`,
      { async: true },
      (code, stdout, stderr) => {
        // delete the original file
        shell.rm(file.path);

        if (code === 0) {
          logger(`${file.filename}: split job finished`, "success");
          resolve(true);
        } else {
          logger(`${file.filename}: Non-zeor exit`, "error");
          logger(`${file.filename}: code ${code}`);
          logger(`${file.filename}: stdout ${stdout}`);
          logger(`${file.filename}: stderr ${stderr}`);

          reject(stderr);
        }
      }
    );
  });
};

export const CreateDirectory = (path: string) => {
  logger(`Creating directory ${path}`);
  shell.mkdir("-p", path);
};
