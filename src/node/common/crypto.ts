import { createReadStream } from "fs";
import { createHash } from "crypto";
import { logger } from "../../util/logger";

export const GenerateHash = (file: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const hash = createHash("md5");

      // file must be the absolute path
      const stream = createReadStream(file);

      stream.on("readable", () => {
        const data = stream.read();
        if (data) hash.update(data);
      });

      stream.on("end", () => {
        const digest = hash.digest("hex");
        logger(`hash ${digest} generated for ${file}`);
        resolve(digest);
      });

      stream.on("error", (err) => {
        logger(
          `Error occured at stream while generating md5 for ${file}`,
          "error"
        );
        logger(err.message, "error");
        reject(err);
      });
    } catch (error) {
      logger(`Error occured while generating md5 for ${file}`, "error");
      logger(error, "error");
      reject(error);
    }
  });
};
