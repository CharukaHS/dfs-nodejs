import fetch from "node-fetch";
import { join } from "path";
import { logger } from "../util/logger";
import { GenerateHash } from "./common/crypto";

export const ValidateChunksChecksum = async (chunk_id: string) => {
  // Generate hash, compare with learner node, send results to master
  const folder = chunk_id.split("-").splice(0, 3).join("-");
  const path = join(__dirname, "tmp", process.pid.toString(), folder, chunk_id);

  try {
    // Generate checksum for chunk
    const hash = await GenerateHash(path);

    // Validate it with the learner node
    const res = await fetch("http://localhost:3001/validate", {
      method: "POST",
      body: JSON.stringify({ hash, chunk_id }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      logger("learner/validate sent not-ok status", "error");
      return false;
    }

    const { valid }: { valid: boolean } = await res.json();

    if (valid) {
      logger(`Found matching hash for ${chunk_id}}`);
      return true;
    } else {
      logger(`Hash mismatch for ${chunk_id}`, "info");
      return false;
    }
  } catch (error) {
    logger("Error occured in ValidateChunksChecksum", "error");
    logger(error, "error");
  }
};

export const GenerateChunkPathToDownload = (chunk_id: string) => {
  const folder = chunk_id.split("-").splice(0, 3).join("-");
  const path = join(__dirname, "tmp", process.pid.toString(), folder, chunk_id);
  return path;
};
