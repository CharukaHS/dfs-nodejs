import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

import { logger } from "../util/logger";

import { AddNewNode, GetMasterNodePort, UpdateNodeMounted } from "./registry";
import { ExportNodeList } from "./ledger";

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
const master_upload_url = () => `http://localhost:${GetMasterNodePort()}`;
app.use("/upload", createProxyMiddleware({ router: master_upload_url }));

app.listen(port, () => {
  logger(`running on port ${port}`, "success");
});
