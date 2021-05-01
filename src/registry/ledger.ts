import nedb from "nedb";
import { logger } from "../util/logger";

export interface ledger_interface {
  node_id: number;
  node_role: "learner" | "dfs";
  node_port?: number;
  node_lastupdate?: number;
  node_mounted?: boolean;
}

const ledger = new nedb<ledger_interface>({
  autoload: true,
  inMemoryOnly: true,
});

// why search in a database when you can store in plain sight?
let MasterPort: number = -1;

export const InsertLedger = (data: ledger_interface) => {
  ledger.insert(data, (err) => {
    if (err) {
      logger("Error occured while inserting to ledger " + err.name, "error");
      logger(err.message, "error");
    } else {
      logger(
        `New ${data.node_role} node ${data.node_id} at ${data.node_port} added to registry`,
        "success"
      );
    }
  });
};

export const FindMasterPort = (): number => MasterPort;

const FindBiggestPIDNode = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    ledger
      .find({})
      .sort({ node_id: -1 })
      .limit(1)
      .exec((err, docs) => {
        if (err) {
          logger(
            "Error occured while sorting master in ledger " + err.name,
            "error"
          );
          logger(err.message, "error");
          reject(err);
        }

        if (!docs.length) {
          logger("Couldn't find any nodes in ledger ", "error");
          reject(new RangeError("Empty node records"));
        }

        MasterPort = docs[0].node_port || -1;

        // hardcoding 4000 might cause problems in the future
        resolve(docs[0].node_port || 4000);
      });
  });
};

export const AssignMasterByForce = async () => {
  logger("Assigning master by service worker");

  if (FindMasterPort() > 0) {
    logger("Master already exist at port " + FindMasterPort(), "info");
    return;
  }

  try {
    MasterPort = await FindBiggestPIDNode();
  } catch (err) {
    if (err) {
      logger("Error occured in  AssignMasterByForce" + err.name, "error");
      logger(err.message, "error");
    }
  }
};
