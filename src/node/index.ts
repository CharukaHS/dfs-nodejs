import express from "express";
import fetch from "node-fetch";
import AbortController from "abort-controller";

import { logger } from "../util/logger";

interface node_interface {
  node_id: number;
  node_role: "dfs";
  node_port?: number;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SERVICE_REGISTRY = "http://localhost:3000";
const NODE_DETAILS: node_interface = {
  node_id: process.pid,
  node_role: "dfs",
};

// Mount express app on given node
const mount_node = (port: number) => {
  logger("Registered in service-registry", "success");
  logger(`Port number ${port}`, "info");

  NODE_DETAILS.node_port = port;

  logger(`Mounting node in localhost:${NODE_DETAILS.node_port}`);
  app.listen(NODE_DETAILS.node_port, () => {
    logger(`Running on port ${NODE_DETAILS.node_port}`, "success");
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
