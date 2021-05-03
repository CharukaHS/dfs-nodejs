import { createReadStream } from "fs";
import { join } from "path";
import fetch from "node-fetch";
import FormData from "form-data";

import { logger } from "../util/logger";
import { CheckFileExist } from "./common/fs";
import { GetNodesThatAlive, ledger_interface } from "./common/ledger";
import {
  AddNewFileToDB,
  DBFindFileRecord,
  ExportMasterDB,
  MasterDocument,
} from "./common/nedb";
import { RunSplitShell } from "./common/shell";
import { GenerateHash } from "./common/crypto";

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

export const HandleFileDistribution = async (doc: MasterDocument) => {
  logger("Handling file distribution");
  for (const chunk of doc.chunks) {
    for (const location of chunk.locations) {
      const form = new FormData();
      const stream = createReadStream(
        join(
          doc.destination,
          process.pid.toString(),
          doc.filename,
          chunk.chunk_id
        )
      );
      form.append("chunk", stream);

      const destination: number = location;

      try {
        const res = await fetch(
          `http://localhost:${destination}/chunk-upload`,
          {
            method: "POST",
            body: form,
          }
        );

        if (!res.ok) {
          logger(
            `Error in sending chunk ${chunk.chunk_id} to localhost:${destination}`,
            "error"
          );
        }

        logger(`Sent chunk ${chunk.chunk_id} to localhost:${destination}`);
      } catch (error) {
        logger(
          `Error while handling chunk ${chunk.chunk_id} to localhost:${destination}`,
          "error"
        );
        logger(error, "error");
      }
    }
  }
};

// Send checksum data to learner node
export const CreateChecksum = async (doc: MasterDocument, path: string) => {
  const results: {
    filename: string;
    checksum: {
      [chunk_id: string]: {
        nodes: number[];
        hash: string;
      };
    };
  } = {
    filename: doc.filename,
    checksum: {},
  };

  // checksum for every chunk
  for (const chunk of doc.chunks) {
    try {
      // Generating hash
      const hash = await GenerateHash(join(path, chunk.chunk_id));

      results.checksum[chunk.chunk_id] = {
        nodes: chunk.locations,
        hash,
      };
    } catch (error) {
      logger("Error occured while generating checksum for chunks", "error");
      logger(error, "error");
    }
  }

  logger("Sending checksum results to learner node");

  try {
    const res = await fetch("http://localhost:3001/new-record", {
      method: "POST",
      body: JSON.stringify({ results }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok)
      logger(
        "Something went wrong while passing checksum results to learner node",
        "error"
      );
  } catch (error) {
    logger("Error occured while sending checksum to learner", "error");
    logger(error, "error");
  }
};

interface ResultInterface {
  [chunk_id: string]: number;
}
export const HandleFileDownloadProcess = async (
  originalname: string
): Promise<{ result: ResultInterface; err: string }> => {
  // container chunk_id and its slave port
  const result: ResultInterface = {};
  try {
    const doc = await DBFindFileRecord(originalname);

    for (const chunk of doc.chunks) {
      result[chunk.chunk_id] = -1; // will be replaced by a slave node port

      for (const slave of chunk.locations) {
        try {
          const res = await fetch(`http://localhost:${slave}/verify-checksum`, {
            method: "POST",
            body: JSON.stringify({ chunk_id: chunk.chunk_id }),
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            logger(
              `http://localhost:${slave}/verify-checksum reponse is not-okay`,
              "error"
            );
            break;
          }

          const json: { ok: boolean } = await res.json();
          if (json.ok) {
            logger(`${chunk.chunk_id} at ${slave} is not corrupted`);
            result[chunk.chunk_id] = slave;
            break;
          }
          logger(`${chunk.chunk_id} at ${slave} is corrupted`, "info");
        } catch (error) {
          // When fetch fails because node doesnt exist anymore
          // loop again, find a copy in another node
          if (error.code === "ECONNREFUSED") {
            logger(`Node ${slave} didn't respond for /verify-checksum`, "info");
            continue;
          }

          logger(`Error while reaching ${slave}/verify-checksum`, "error");
          logger(error, "error");
        }
      }

      // if its still -1, no node has that chunk
      if (result[chunk.chunk_id] === -1) {
        return {
          result: {},
          err: `Couldn't find a node with chunk ${chunk.chunk_id}`,
        };
      }
    }
  } catch (error) {
    logger("Error in HandleFileDownloadProcess", "error");
    logger(error, "error");
    return { result: {}, err: error };
  }
  return { result, err: "" };
};
