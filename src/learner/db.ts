import nedb from "nedb";
import { join } from "path";
import { logger } from "../util/logger";

interface checksum_records {
  filename: string;
  checksum: {
    [chunk_id: string]: {
      nodes: number[];
      hash: string;
    };
  };
}

// holds data about chunk id and its md5
const DB = new nedb<checksum_records>({
  autoload: true,
  filename: join(__dirname, "checksum"),
});

// Get all checksums for all chunks in given file
const SearchFileRecord = (filename: string): Promise<checksum_records> => {
  return new Promise((resolve, reject) => {
    DB.findOne({ filename }, (err, doc) => {
      if (err) reject(err);
      resolve(doc);
    });
  });
};

// Add data to database
export const InsertData = (data: checksum_records) => {
  logger("Received checksum records of " + data.filename, "info");
  DB.insert(data, (err) => {
    if (err)
      return logger("Error occured while saving data to nedb " + err, "error");
  });
};

// Validate given value with the value in the records
let cached: checksum_records = { filename: "", checksum: {} }; // use for caching
export const ValidateData = async (
  chunk_id: string,
  hash: string
): Promise<boolean> => {
  try {
    // Generate file name from chunk id
    const filename = chunk_id.split("-").splice(0, 3).join("-");

    // if cached document doesn't match with file name, search in database
    if (cached.filename !== filename) cached = await SearchFileRecord(filename);

    const record = cached.checksum?.[chunk_id];
    if (!record) {
      logger(`No record about chunk ${chunk_id}`, "error");
      return false;
    }

    // compare checksums
    if (record.hash === hash) {
      logger(`Hash verify for file ${chunk_id}`, "success");
      return true;
    } else {
      logger(`Hash mismatch for file ${chunk_id}`, "info");
      return false;
    }
  } catch (error) {
    logger("Error occured in ValidateData", "error");
    logger(error, "error");
    return false;
  }
};
