import fetch from "node-fetch";
import { logger } from "../util/logger";
import {
  AssignMasterByForce,
  FindMasterPort,
  GetAllNodes,
  InsertLedger,
  ledger_interface,
} from "./ledger";

let nextdfsport = 4000;
let master_exist = false;

// Return master node
export const GetMasterNodePort = FindMasterPort;

// Add new node to the ledger
export const AddNewNode = async (data: ledger_interface): Promise<number> => {
  /*
  port for nodes is assigned dynamically.
  if node is a learner node, port is 3001
  if node is a dfs node, port is 4000 <= x < 5000
  */

  if (data.node_role === "learner") {
    data.node_port = 3001;
  } else {
    data.node_port = nextdfsport;
    nextdfsport++;
  }

  // insert to ledger
  InsertLedger(data);

  // send the mounting port
  return data.node_port;
};

// Update node_mounted status
export const UpdateNodeMounted = async (port: number, pid: number) => {
  logger(`Mounting node ${pid}@localhost:${port} is success`, "success");
  if (!master_exist) {
    await AssignMasterByForce();
    master_exist = true;

    try {
      // notifying that node 'you are the master'
      const res = await fetch(
        `http://localhost:${FindMasterPort()}/first-master`,
        {
          method: "POST",
        }
      );

      if (res.ok) {
        logger(
          `Port ${FindMasterPort()} is selected as the president by service registry`,
          "info"
        );
      }
    } catch (error) {
      logger(
        `Error occured while http://localhost:${FindMasterPort()}/first-master`,
        "error"
      );
      logger(error, "error");
    }
  }

  logger(`Broadcasting about the newest node ${pid}@${port}`);
  try {
    const list = await GetAllNodes();
    list.forEach(async (l) => {
      // avoid updating self
      if (l.node_id === pid) return;

      // sending post requests
      const res = await fetch(`http://localhost:${l.node_port}/node-update`, {
        method: "POST",
        body: JSON.stringify({
          newnode: { node_id: pid, node_port: port, node_role: "dfs" },
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        logger(`Informed ${l.node_id}@${l.node_port} successfully`);
      }
    });
  } catch (error) {
    logger(
      "Error occured while informing other nodes about new nodes " + error.name,
      "error"
    );
    logger(error, "error");
  }
};
