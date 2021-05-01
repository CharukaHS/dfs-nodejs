import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import AbortController from "abort-controller";
import multer from "multer";
import { join } from "path";

import { logger } from "../util/logger";
import { SplitFile } from "./master";
import { CheckUploadDirExist } from "./common/fs";
import { InsertToLedger, PopulateLedger } from "./common/election";

interface node_interface {
  node_id: number;
  node_role: "master" | "slave";
  node_port?: number;
}

const SERVICE_REGISTRY = "http://localhost:3000";
const NODE_DETAILS: node_interface = {
  node_id: process.pid,
  node_role: "slave",
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

// Endpoints - Common
/*
  The first master, at the start of all process will be determined by
  the service registry

  if service registry noticed there isn't any master among the nodes,
  service worker will send a post request to below endpoint of the node
  which has the highest pid
*/
app.post("/first-master", (req, res) => {
  logger("Elected as master without a election", "success");
  NODE_DETAILS.node_role = "master";
  res.sendStatus(200);
});

/*
  When a new node is added to the registry ledger, service registry inform
  other nodes via this endpoint
*/
app.post("/node-update", (req, res) => {
  InsertToLedger(req.body.newnode);
});

// Endpoints - Master
app.post("/upload", upload.single("inputfile"), (req, res) => {
  if (NODE_DETAILS.node_role != "master") {
    logger(
      `localhost:${NODE_DETAILS.node_port} received an upload file but it isn't the master`,
      "error"
    );
  }
  logger(`Received a file ${req.file.originalname}`, "info");
  SplitFile(req.file);
  res.sendStatus(200);
});

// Mount express app on given node
const mount_node = (port: number) => {
  logger("Registered in service-registry", "success");

  NODE_DETAILS.node_port = port;

  logger(`Mounting node in localhost:${NODE_DETAILS.node_port}`);
  app.listen(NODE_DETAILS.node_port, () => {
    logger(`Running on port ${NODE_DETAILS.node_port}`, "success");

    // Make sure uploads saving directory exist, if not create one
    CheckUploadDirExist(TMP_PATH, NODE_DETAILS.node_id.toString());

    // send a signal to registry to update status
    fetch(SERVICE_REGISTRY + "/mount-success", {
      method: "POST",
      body: JSON.stringify({
        pid: process.pid,
        port: NODE_DETAILS.node_port,
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (res.ok) {
          logger("Updated status in registry");
        } else {
          logger("Failed to update status in registry", "error");
        }
        return res.json();
      })
      .then((json) => {
        PopulateLedger(json);
      });
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
