import fetch from "node-fetch";
import AbortController from "abort-controller";
import { logger } from "../../util/logger";
import { NODE_DETAILS } from "../util";

interface inputdata_interface {
  node_id: number;
  node_role: "learner" | "dfs";
  node_port: number;
}
interface ledger_interface extends inputdata_interface {
  alive: boolean;
  last_update: number;
}

const ledger: ledger_interface[] = [];

// Health check, check other nodes status
const INTERVAL = 30 * 1000; // check health of other nodes for every x seconds
const TIMEOUT = 150; // if node didn't respond in x milli-seconds, consider its dead

const CheckOthersHealth = async () => {
  logger("Running health check function");
  ledger.forEach(async (node) => {
    // setup request timeout
    const controller = new AbortController();
    const healthcheck_timeout = setTimeout(() => {
      controller.abort();
    }, TIMEOUT);

    try {
      // send request
      const res = await fetch(
        `http://localhost:${node.node_port}/health-check`,
        {
          method: "POST",
          signal: controller.signal,
        }
      );

      if (res.ok) {
        node.alive = true;
        node.last_update = Date.now();
        logger(`${node.node_port} is alive`);
      }
    } catch (error) {
      if (error) {
        logger(
          `Node ${node.node_port} didn't respond for health-check`,
          "error"
        );
        node.alive = false;
      }
    } finally {
      clearTimeout(healthcheck_timeout);
    }
  });
};

// Runs on the first time, add information about all previous nodes
export const PopulateLedger = (data: inputdata_interface[]) => {
  logger("Populating node ledger with " + (data.length - 1) + " nodes"); // because data has current node's detaisl too
  data.forEach((e) => {
    // registry send information about every node, include about this node too
    // filterning out details about this node
    if (e.node_port === NODE_DETAILS.node_port) return;

    let doc: ledger_interface = { ...e, alive: true, last_update: Date.now() };
    ledger.push(doc);
  });
};

// Runs everytime a new node is appear
export const InsertToLedger = (data: inputdata_interface) => {
  logger(
    "Received a update to node list " + data.node_id + "@" + data.node_port
  );
  let doc: ledger_interface = { ...data, alive: true, last_update: Date.now() };
  ledger.push(doc);
};

export const StartHealthCheckTimer = async () => {
  logger("Starting health checking timer");
  setInterval(CheckOthersHealth, INTERVAL);
};
