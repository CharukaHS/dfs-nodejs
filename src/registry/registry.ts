import { logger } from "../util/logger";

interface ledger_interface {
  node_id: string;
  node_role: "learner" | "dfs" | "master" | "slave";
  node_port?: number;
  node_lastupdate?: number;
}

const ledger: ledger_interface[] = [];
let nextdfsport = 4000;

// Return master node
export const GetMasterNodePort = (): number => {
  // if ledger is empty
  if (!ledger.length) return 0;

  // TODO: return the true master
  return ledger[ledger.length - 1].node_port || 0;
};

// Add new node to the ledger
export const AddNewNode = async (data: ledger_interface): Promise<number> => {
  data.node_lastupdate = Date.now();

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

  ledger.push(data);

  logger(
    `New ${data.node_role} node ${data.node_id} at ${data.node_port} added to registry`,
    "success"
  );
  return data.node_port;
};
