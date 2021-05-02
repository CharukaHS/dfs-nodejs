import fetch from "node-fetch";
import { logger } from "../util/logger";
import { CheckFileExist } from "./common/fs";
import { GetNodesThatAlive } from "./common/ledger";
import { AddNewFileToDB, ExportMasterDB, MasterDocument } from "./common/nedb";
import { RunSplitShell } from "./common/shell";

export interface inputdata_interface {
  node_id: number;
  node_role: "learner" | "dfs";
  node_port: number;
}

// Process of splitting the file into chunks
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

export const SendDBSnapshot = async (node: inputdata_interface) => {
  const snapshot = ExportMasterDB();
  try {
    const res = await fetch(
      `http://localhost:${node.node_port}/clone-master-db`,
      {
        method: "POST",
        body: JSON.stringify({ snapshot }),
        headers: { "Content-Type": "application/json" },
      }
    );

    if (res.ok) logger("Nedb snapshot sent to " + node.node_port);
  } catch (error) {
    logger(
      "Error occured while sending snapshot to node " + node.node_port,
      "error"
    );
    logger(error, "error");
  }
};

export const BroadcastNewFileData = async (doc: MasterDocument) => {
  const nodes = GetNodesThatAlive();
  nodes.forEach(async (node) => {
    try {
      const res = await fetch(
        `http://localhost:${node.node_port}/update-master-db`,
        {
          method: "POST",
          body: JSON.stringify({ data: doc }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.ok) logger("Nedb new file data sent to " + node.node_port);
    } catch (error) {
      logger(
        "Error occured while sending new file data to node " + node.node_port,
        "error"
      );
      logger(error, "error");
    }
  });
};
