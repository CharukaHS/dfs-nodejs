import WebSocket from "ws";
import fetch from "node-fetch";
import { logger } from "../util/logger";
import { writeFile } from "fs/promises";
import { join } from "path";
import shell from "shelljs";

const DownloadChunk = async (chunk_id: string, port: number) => {
  try {
    logger(`Downloading chunk ${chunk_id} from ${port}`);

    // Download chunks
    const res = await fetch(`http://localhost:${port}/download-chunk`, {
      method: "POST",
      body: JSON.stringify({ chunk_id }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw Error(`${chunk_id}@${port} res not okay. Status ${res.status}`);
    }

    // Response into a buffer
    const buffer = await res.buffer();

    // chunks save folder
    const folder_path = join(
      "downloads",
      chunk_id.split("-").splice(0, 3).join("-")
    );

    // creating directory for chunks
    shell.mkdir("-p", folder_path);

    // save buffer into file
    await writeFile(join(folder_path, chunk_id), buffer);

    logger(`${chunk_id} downloaded`, "success");
  } catch (error) {
    logger(error, "error");
  }
};

export const ParallelDownload = async (filename: string, ws: WebSocket) => {
  logger(`Starting downloading file ${filename}`);
  try {
    const res = await fetch("http://localhost:3000/download", {
      method: "POST",
      body: JSON.stringify({ filename }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      logger("Response of service-registry/download is not okay", "error");
      ws.send("err Response of service-registry/download is not okay");
      return;
    }

    const { result, err } = await res.json();

    if (err) throw Error(err);

    // convert object into an array
    const arr = [];
    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        const element = result[key];
        arr.push({ chunk_id: key, node: element });
      }
    }

    // parallel download
    await Promise.all(
      arr.map(async (chunk) => {
        await DownloadChunk(chunk.chunk_id, chunk.node);
      })
    );

    // Merge chunks into single file
    const chunk_folder_path = `downloads/${arr[0].chunk_id
      .split("-")
      .splice(0, 3)
      .join("-")}`;

    const prefix = arr[0].chunk_id.split("-").slice(0, 3).join("-") + "-";

    const output_path = `downloads/${filename}`;
    const bash_path = join(__dirname, "combine.sh");

    shell.exec(
      `bash ${bash_path} '${chunk_folder_path}' '${prefix}' '${output_path}'`,
      { async: true },
      (code, stdout, stderr) => {
        // delete the chunks folder

        if (code === 0) {
          logger(`${filename}:download successfull`, "success");
          logger(`Deleting folder ${chunk_folder_path}`);
          // shell.rm("-r", chunk_folder_path);

          ws.send("succ");
        } else {
          logger(`${filename}: Non-zeor exit`, "error");
          logger(`${filename}: code ${code}`);
          logger(`${filename}: stdout ${stdout}`);
          logger(`${filename}: stderr ${stderr}`);
        }
      }
    );
  } catch (error) {
    logger(error, "error");
    ws.send("err Error occured, check CLI");
  }
};
