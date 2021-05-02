import multer from "multer";
import { join } from "path";
import { CreateDirectory } from "./common/shell";

export const TMP_PATH = join(__dirname + "/tmp");

const MasterStorageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_PATH);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1000)}`
    );
  },
});

const SlaveStorageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.originalname.split("-").splice(0, 3).join("-");
    const destination = join(TMP_PATH, process.pid.toString(), folder);

    // create the folder
    // don't delete, node would crash!
    CreateDirectory(destination);

    cb(null, destination);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

export const MasterUpload = multer({ storage: MasterStorageConfig });
export const SlaveUpload = multer({ storage: SlaveStorageConfig });
