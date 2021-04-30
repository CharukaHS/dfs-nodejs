import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import AbortController from "abort-controller";
import multer from "multer";
import { join } from "path";

import { logger } from "../util/logger";
import { SplitFile } from "./master";
import { CheckUploadDirExist } from "./common/fs";

interface node_interface {
  node_id: number;
  node_role: "dfs";
  node_port?: number;
}

const SERVICE_REGISTRY = "http://localhost:3000";
const NODE_DETAILS: node_interface = {
  node_id: process.pid,
  node_role: "dfs",
};

// express config
const app = express();
app.use(cors({ allowedHeaders: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// multer config
// files are temporary saved in /tmp
// chunked saved in /tmp/$pid
const TMP_PATH = join(__dirname + "/tmp");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_PATH);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname +
        "-" +
        Date.now() +
        "-" +
        Math.round(Math.random() * 100000)
    );
  },
});
const upload = multer({ storage });

// Endpoints - Master
app.post("/upload", upload.single("inputfile"), (req, res) => {
  logger(`Received a file ${req.file.originalname}`, "info");
  SplitFile(req.file);
  res.sendStatus(200);
});

// Mount express app on given node
const mount_node = (port: number) => {
  logger("Registered in service-registry", "success");
  logger(`Port number ${port}`, "info");

  NODE_DETAILS.node_port = port;

  logger(`Mounting node in localhost:${NODE_DETAILS.node_port}`);
  app.listen(NODE_DETAILS.node_port, () => {
    logger(`Running on port ${NODE_DETAILS.node_port}`, "success");

    // Make sure uploads saving directory exist, if not create one
    CheckUploadDirExist(TMP_PATH, NODE_DETAILS.node_id.toString());
  });
};

(() => {
  // get port number from service registry
  logger("Contacting service-registry", "debug");

  // handle timeout
  const controller = new AbortController();
  const sr_timeout = setTimeout(() => {
    controller.abort();
  }, 150);

  fetch(SERVICE_REGISTRY + "/register", {
    method: "POST",
    body: JSON.stringify(NODE_DETAILS),
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
  })
    .then((res) => res.json())
    .then(
      (json) => {
        mount_node(json.port);
      },
      (err) => {
        logger("Error occured", "error");
        logger(err, "error");
      }
    )
    .finally(() => {
      clearTimeout(sr_timeout);
    });
})();
