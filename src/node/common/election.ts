import fetch from "node-fetch";
import AbortController from "abort-controller";
import { NODE_DETAILS, SERVICE_REGISTRY, SetMasterPort } from "../util";
import { logger } from "../../util/logger";
import { GetNodesThatAlive } from "./ledger";

let pending_election: boolean = false;
export const ConductElection = async () => {
  // Skip if an election is already conducting
  if (pending_election) return;

  // Set an election is already conducting
  pending_election = true;

  logger("Starting an election", "info");
  // filter out nodes which has higher PID than this node
  const nodes = GetNodesThatAlive();
  const candidates = nodes.filter(
    (node) => node.node_id > NODE_DETAILS.node_id && node.alive
  );

  let gotaresponse: boolean = false;

  // send a signal to each candidate
  for (const cand of candidates) {
    const controller = new AbortController();
    const election_timeout = setTimeout(() => {
      controller.abort();
    }, 200);
    try {
      const res = await fetch(`http://localhost:${cand.node_port}/election`, {
        method: "POST",
        signal: controller.signal,
      });

      if (res.ok) {
        gotaresponse = true;
      }
    } catch (error) {
      logger(`${cand.node_id}@${cand.node_port} didn't respond to election`);
    } finally {
      clearTimeout(election_timeout);
    }
  }

  // gotareponse means better candidates are alive
  if (gotaresponse) {
    logger(
      "Higher PID node(s) did repond, waiting for other nodes election result",
      "info"
    );
    pending_election = false;
    return;
  }

  // no one responded or no one to request, this node will be the master
  if (!candidates.length) {
    logger("No candidates", "info");
  } else {
    logger("Higher candidates didn't respond", "info");
  }

  logger("Consider myself as the master", "info");

  // I AM THE MASTER
  SetMasterPort(0); // 0 to indicate current node is master

  // Tell others whos the boss now
  await BroadcastMasterStatus();

  // Inform registry
  try {
    const res = await fetch(SERVICE_REGISTRY + "/new-master", {
      method: "POST",
      body: JSON.stringify({
        masterport: NODE_DETAILS.node_port,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) logger(`Updated service registry about new master`);
  } catch (error) {
    logger(`Error occured while informing to service registry`, "error");
    logger(error, "error");
  } finally {
    pending_election = false;
  }
};

export const BroadcastMasterStatus = async () => {
  const nodes = GetNodesThatAlive();
  for (const node of nodes) {
    try {
      const res = await fetch(`http://localhost:${node.node_port}/set-master`, {
        method: "POST",
        body: JSON.stringify({
          masterport: NODE_DETAILS.node_port,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok)
        logger(`Updated ${node.node_id}@${node.node_port} about new master`);
    } catch (error) {
      // Caution, Fetch errors occur when request didn't reached the endpoint
      // here I just assume its because node is dead and that is why we conducted the election
      if (error.name === "FetchError") return;
      logger(
        `Error occured while informing to node localhost:${node.node_port}`,
        "error"
      );
      logger(error, "error");
    }
  }
};
