import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import fetch from "node-fetch";

import { logger } from "../util/logger";
import { AddNewNode, GetMasterNodePort, UpdateNodeMounted } from "./registry";
import { ExportNodeList, SetMasterPort } from "./ledger";

// express config
const app = express();
const port: number = 3000;
app.use(cors({ allowedHeaders: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
  Registering new nodes in ledger
*/
app.post("/register", async (req, res) => {
  const port = await AddNewNode(req.body);
  res.json({ port });
});

/*
  Signal from node which emit after mounting on given port
*/
app.post("/mount-success", async (req, res) => {
  const { pid, port } = req.body;
  await UpdateNodeMounted(port, pid);
  const nodes = await ExportNodeList();
  res.json(nodes);
});

/*
  Handle file uploads
  http proxy for redirect uploads
*/
const master_node_url = () => `http://localhost:${GetMasterNodePort()}`;
app.use("/upload", createProxyMiddleware({ router: master_node_url }));

/*
  Redirect download requests

  Note: Proxying should work, but for some reason POST requests that contain data in body
  cause requests to timeout
*/
// app.use("/download", createProxyMiddleware({ router: master_node_url }));
app.post("/download", async (req, res) => {
  try {
    logger(`Received download request ${req.body.filename}}`);

    // redirecting request to master
    const response = await fetch(`${master_node_url()}/download`, {
      method: "POST",
      body: JSON.stringify({
        filename: req.body.filename,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw Error("Response is not okay");
    }

    // get json
    const { result, err } = await response.json();

    res.status(200).json({ result, err });
  } catch (error) {
    logger(error, "error");
    res.sendStatus(500);
  }
});

/*
  Election results
*/
app.post("/new-master", (req, res) => {
  // multiple elections, same result. Avoiding re-updating variable
  if (GetMasterNodePort() !== req.body.masterport) {
    logger(`Received a new master node port ${req.body.masterport}`, "info");
    SetMasterPort(req.body.masterport);
  }
  res.sendStatus(200);
});

app.listen(port, () => {
  logger(`running on port ${port}`, "success");
});
