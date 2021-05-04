import express from "express";
import cors from "cors";
import websocket from "ws";

import { join } from "path";
import { logger } from "../util/logger";
import { popd } from "shelljs";
import { ParallelDownload } from "./download";

const PORT = 8080;
const app = express();
const wss = new websocket.Server({ noServer: true });

// express config
app.use(cors({ allowedHeaders: "*" }));
app.use(express.static(join(__dirname, "/public")));

// endpoints
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "/index.html"));
});

const server = app.listen(PORT, () => {
  logger(`Client running on localhost:${PORT}/`, "success");
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (socket) => {
    logger("Websocket running", "success");
    wss.emit("connection", socket, req);
  });
});

// web socket events
wss.on("connection", (ws) => {
  ws.on("message", (evt) => {
    let arr = evt.toString().split(" ");
    const command = arr.shift();
    const data = arr.join(" ");

    switch (command) {
      case "download":
        ParallelDownload(data, ws);
        break;

      default:
        break;
    }
  });
});
