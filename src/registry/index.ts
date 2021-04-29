import express from "express";
import { logger } from "../util/logger";
import { AddNewNode } from "./registry";

const app = express();
const port: number = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  logger("vibe check");
  res.send("vibe check");
});

/*
Registering new nodes in ledger
*/
app.post("/register", async (req, res) => {
  const port = await AddNewNode(req.body);
  res.json({ port });
});

app.listen(port, () => {
  logger(`running on port ${port}`, "success");
});
