import express from "express";
import cors from "cors";
import { join } from "path";
import { logger } from "../util/logger";

const app = express();
const port = 8080;

// express config
app.use(cors({ allowedHeaders: "*" }));
app.use(express.static(join(__dirname, "/public")));

// endpoints
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "/index.html"));
});

app.listen(port, () => {
  logger(`Client running on localhost:${port}/`, "success");
});
