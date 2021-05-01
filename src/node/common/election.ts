import { logger } from "../../util/logger";

interface nodes_interface {
  node_id: number;
  port: number;
}
const ledger: nodes_interface[] = [];

export const PopulateLedger = (data: nodes_interface[]) => {
  logger("Populating node ledger with " + data.length + " nodes");
  data.forEach((e) => {
    ledger.push(e);
  });
};

export const InsertToLedger = (data: nodes_interface) => {
  logger("Received a update to node list " + data.node_id + "@" + data.port);
  ledger.push(data);
};
