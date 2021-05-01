import fetch from "node-fetch";
import { logger } from "../util/logger";
import {
  AssignMasterByForce,
  FindMasterPort,
  InsertLedger,
  ledger_interface,
} from "./ledger";

let nextdfsport = 4000;
let master_exist = false;

// Return master node
export const GetMasterNodePort = FindMasterPort;

// Add new node to the ledger
export const AddNewNode = async (data: ledger_interface): Promise<number> => {
  data.node_lastupdate = Date.now();
  data.node_mounted = false;

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

    // notifying that node 'you are the master'
    fetch(`http://localhost:${FindMasterPort()}/first-master`, {
      method: "POST",
    }).then((res) => {
      if (res.ok) {
        logger(
          `Port ${FindMasterPort()} is selected as the president by service registry`,
          "info"
        );
      }
    });
  }
};
