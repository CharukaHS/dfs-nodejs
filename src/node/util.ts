import fetch from "node-fetch";
import AbortController from "abort-controller";
import { logger } from "../util/logger";
import { PopulateLedger, StartHealthCheckTimer } from "./common/election";

interface node_interface {
  node_id: number;
  node_role: "master" | "slave";
  node_port?: number;
}

const SERVICE_REGISTRY = "http://localhost:3000";
export const NODE_DETAILS: node_interface = {
  node_id: process.pid,
  node_role: "slave",
};

// Request a port number from service registry
export const GetPortNumber = async () => {
  logger("Contacting service-registry");

  // handle timeout
  const controller = new AbortController();
  const sr_timeout = setTimeout(() => {
    controller.abort();
  }, 150);

  try {
    const res = await fetch(SERVICE_REGISTRY + "/register", {
      method: "POST",
      body: JSON.stringify(NODE_DETAILS),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    const json = await res.json();

    logger("Registered in service-registry", "success");
    NODE_DETAILS.node_port = json.port;
  } catch (error) {
    logger("Error occured", "error");
    logger(error, "error");
  } finally {
    clearTimeout(sr_timeout);
  }
};

// Send mounted signal to service registry
export const SignalToServiceRegistry = async () => {
  try {
    const res = await fetch(SERVICE_REGISTRY + "/mount-success", {
      method: "POST",
      body: JSON.stringify({
        pid: process.pid,
        port: NODE_DETAILS.node_port,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      logger("Failed to pdated status in registry", "error");
      return;
    }

    const json = await res.json();

    // Populate node's ledger
    PopulateLedger(json);

    // Start signaling /health-check to other nodes
    StartHealthCheckTimer();
  } catch (error) {
    logger("Error occured in SignalToServiceRegistry", "error");
    logger(error, "error");
  }
};
