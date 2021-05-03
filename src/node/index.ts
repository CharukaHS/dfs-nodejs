import express from "express";
import cors from "cors";
import { MasterUpload, SlaveUpload, TMP_PATH } from "./multer";

import {
  GetMasterPort,
  GetPortNumber,
  NODE_DETAILS,
  SetMasterPort,
  SignalToServiceRegistry,
} from "./util";
import { logger } from "../util/logger";
import { HandleFileDownloadProcess, SendDBSnapshot, SplitFile } from "./master";
import { CheckUploadDirExist } from "./common/fs";
import { InsertToLedger } from "./common/ledger";
import { BroadcastMasterStatus, ConductElection } from "./common/election";
import { DataForNewDatabase, UpdateMasterDB } from "./common/nedb";
import { ValidateChunksChecksum } from "./slave";

// express config
const app = express();
app.use(cors({ allowedHeaders: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//#region Endpoints - Common
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
//#endregion

//#region Endpoints - Master
/* 
  Handle uploads redirected by service registry
*/
app.post("/upload", MasterUpload.single("inputfile"), (req, res) => {
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

/*
  Handle downloads redirected by service registry
*/
app.post("/download", async (req, res) => {
  try {
    logger(`Receiving download request for ${req.body.filename}`, "info");
    const { result, err } = await HandleFileDownloadProcess(req.body.filename);
    logger(
      `Responded to client with chunks and slave node details about ${req.body.filename}`,
      "info"
    );
    res.status(200).json({ result, err });
  } catch (error) {
    logger("Error at /download", "error");
    logger(error, "error");
    res.sendStatus(500);
  }
});
//#endregion

//#region  Endpoints - Slave
/*
  On fresh startups, keep upto-date with master's nedb
*/
app.post("/clone-master-db", (req, res) => {
  logger("Received the database snapshot from master node");
  DataForNewDatabase(req.body.snapshot);
  res.sendStatus(200);
});

/*
  Handle chunks
*/
app.post("/chunk-upload", SlaveUpload.single("chunk"), (req, res) => {
  logger(`Chunk received ${req.file.originalname}`);
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

/* 
  master verifing chunks not corrupted
*/
app.post("/verify-checksum", async (req, res) => {
  try {
    const validity = await ValidateChunksChecksum(req.body.chunk_id);
    res.status(200).json({ ok: validity });
  } catch (error) {
    logger("Error occured in /verify-checksum", "error");
    logger(error, "error");
    res.sendStatus(500);
  }
});

//#endregion

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
