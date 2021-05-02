import nedb from "nedb";
import { readdir } from "fs";
import { join } from "path";
import { logger } from "../../util/logger";
import { BroadcastNewFileData } from "../master";

// interfaces
export interface MasterDocument extends Express.Multer.File {
  chunks: {
    chunk_id: string;
    locations?: string[];
  }[];
}

// datastores
const MasterDatastore = new nedb<MasterDocument>({
  autoload: true,
  filename: join(__dirname, "../tmp/", process.pid.toString(), "masterdb"),
  timestampData: true,
});

// functions
// Bring the newly created node's database upto date with master node's database
export const DataForNewDatabase = (data: MasterDocument[]) => {
  data.forEach((doc) => {
    MasterDatastore.insert(doc, (err) => {
      if (err) {
        logger(
          "Error occured in nedb DataForNewDatabase " + err.message,
          "error"
        );
      }
    });
  });
  logger("Node's file database is up-to-date", "info");
};

// Storing file meta data, chunks, locations in database
export const AddNewFileToDB = async (file: Express.Multer.File) => {
  const doc: MasterDocument = { ...file, chunks: [] };
  const destination = join(
    file.destination,
    process.pid.toString(),
    file.filename
  );

  readdir(destination, (err, files) => {
    if (err) {
      logger(
        `${file.filename}: Error occured while reading file directory`,
        "error"
      );
      logger(err.toString(), "error");
      return;
    }

    files.forEach((f) => {
      doc.chunks.push({ chunk_id: f });
    });

    MasterDatastore.insert(doc, (err) => {
      if (err) logger(`${file.filename}: Inserted chunk data to database`);

      // Tell every node about the new file
      BroadcastNewFileData(doc);
    });
  });
};

// Return all data inside the database
export const ExportMasterDB = () => {
  const all: MasterDocument[] = MasterDatastore.getAllData();
  return all;
};

// Data receive from master node
export const UpdateMasterDB = (data: MasterDocument) => {
  MasterDatastore.insert(data, (err) => {
    if (!err) {
      logger(`Received update to master database about ${data.filename}`);
    } else {
      logger("Error in updating master db " + data.filename, "error");
      logger(err.message, "error");
    }
  });
};
