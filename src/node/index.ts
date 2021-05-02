import express from "express";
import cors from "cors";
import multer from "multer";
import { join } from "path";

import {
  GetMasterPort,
  GetPortNumber,
  NODE_DETAILS,
  SetMasterPort,
  SignalToServiceRegistry,
} from "./util";
import { logger } from "../util/logger";
import { SendDBSnapshot, SplitFile } from "./master";
import { CheckUploadDirExist } from "./common/fs";
import { InsertToLedger } from "./common/ledger";
import { BroadcastMasterStatus, ConductElection } from "./common/election";
import { DataForNewDatabase, UpdateMasterDB } from "./common/nedb";

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

  // set role and port
  NODE_DETAILS.node_role = "master";
  SetMasterPort(0);

  // Broadcast the status
  BroadcastMasterStatus();

  res.sendStatus(200);
});

/*
  When a new node is added to the registry ledger, service registry inform
  other nodes via this endpoint
*/
app.post("/node-update", (req, res) => {
  InsertToLedger(req.body.newnode);

  // if this node is the master, send a snapshot of database
  // GetMasterPort return 0 if the current node's port is master
  if (!GetMasterPort()) SendDBSnapshot(req.body.newnode);
  res.sendStatus(200);
});

/*
  Health check
  response 200 just to say node is alive
*/
app.post("/health-check", (req, res) => {
  res.sendStatus(200);
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

// Endpoints - Slave
/*
  On fresh startups, keep upto-date with master's nedb
*/
app.post("/clone-master-db", (req, res) => {
  logger("Received the database snapshot from master node");
  DataForNewDatabase(req.body.snapshot);
  res.sendStatus(200);
});

/* 
  When an election is conducting
*/
app.post("/election", (req, res) => {
  ConductElection();
  res.sendStatus(200);
});

/*
  When a new master elected, it informed to this
*/
app.post("/set-master", (req, res) => {
  logger(`Setting localhost:${req.body.masterport} as the master`, "info");
  SetMasterPort(req.body.masterport);
  res.sendStatus(200);
});

/*
  On master node sends information about new files chunks and metadata
*/
app.post("/update-master-db", (req, res) => {
  UpdateMasterDB(req.body.data);
  res.sendStatus(200);
});

// On Mount
(async () => {
  // Get a port number from service registry to mount
  await GetPortNumber();

  app.listen(NODE_DETAILS.node_port, () => {
    logger(`PID: ${NODE_DETAILS.node_id}`, "info");
    logger(`Running on port ${NODE_DETAILS.node_port}`, "success");

    // Make sure uploads saving directory exist, if not create one
    CheckUploadDirExist(TMP_PATH, NODE_DETAILS.node_id.toString());

    // send a signal to registry to update status
    SignalToServiceRegistry();
  });
})();
