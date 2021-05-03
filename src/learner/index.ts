import express from "express";
import cors from "cors";
import { logger } from "../util/logger";
import { InsertData, ValidateData } from "./db";

// express config
const app = express();
app.use(cors({ allowedHeaders: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Receive checksums of new file from master
app.post("/new-record", (req, res) => {
  InsertData(req.body.results);
  res.sendStatus(200);
});

// Validate checksum
app.post("/validate", async (req, res) => {
  const { chunk_id, hash } = req.body;
  try {
    const valid = await ValidateData(chunk_id, hash);
    res.status(200).json({ valid });
  } catch (error) {
    logger("Error occured in /validate", "error");
    logger(error, "error");
    res.status(500).json({ valid: false });
  }
});

const PORT: number = 3001;
app.listen(PORT, () => {
  logger("Learner node mounted at " + PORT, "success");
});
