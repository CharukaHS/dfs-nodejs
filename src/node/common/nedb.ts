import nedb from "nedb";
import { readdir } from "fs";
import { join } from "path";
import { logger } from "../../util/logger";

// interfaces
interface MasterDocument extends Express.Multer.File {
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
    });
  });
};
