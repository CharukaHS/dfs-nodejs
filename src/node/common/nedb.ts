import nedb from "nedb";
import { join } from "path";
import { logger } from "../../util/logger";
import { BroadcastNewFileData, HandleFileDistribution } from "../master";
import { ReadDirectory } from "./fs";
import { GetNodesThatAlive } from "./ledger";

// interfaces
export interface MasterDocument extends Express.Multer.File {
  chunks: {
    chunk_id: string;
    locations: number[]; // contain the port numbers
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

  // Read chunks files
  const files = await ReadDirectory(destination);

  // For redundacy purpose, n copies of same chunks are saved in two different nodes
  // Chunk saving nodes is calculated based on the chunk index
  // slave1 => index % no of nodes
  // slave2 => (index+1) % no of nodes
  // ...etc

  const slaves = GetNodesThatAlive();
  const REDUNDANT_COPIES: number = 2;

  files.forEach((f, i) => {
    const selected_slaves: number[] = [];
    for (let index = 0; index < REDUNDANT_COPIES; index++) {
      const value = (i + index) % slaves.length;
      selected_slaves.push(value);
    }

    doc.chunks.push({ chunk_id: f, locations: selected_slaves });
  });

  MasterDatastore.insert(doc, (err) => {
    if (err) logger(`${file.filename}: Inserted chunk data to database`);

    // Tell every node about the new file
    BroadcastNewFileData(doc);

    // Distribute chunks among slave nodes
    HandleFileDistribution(doc, slaves);
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
