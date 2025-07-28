import { Router } from "express";
import BlockController from "./module/block/block.contoller";
import ExplorerController from "./module/explorer/explorer.controller";
import DelegatorController from "./module/delegator/delegator.controller";
import ValidatorController from "./module/validator/validator.controller";
import TransactionsController from "./module/transactions/transaction.controller";
import ContractController from "./module/contract/contract.controller";
import TokenController from "./module/Token/token.controller";
import ProposalController from "./module/proposal/proposal.controller";
import NodeController from "./module/node/node.controller";
import MessageController from "./module/message/message.controller";

/**
 * Here, you can register routes by instantiating the controller.
 *
 */
export default function registerRoutes(): Router {
  const router = Router();

  const blockController = new BlockController();
  const delegatorController = new DelegatorController();
  const validatorController = new ValidatorController();
  const explorerController = new ExplorerController();
  const transactionsController = new TransactionsController();
  const contractController = new ContractController();
  const tokenContoller = new TokenController();
  const messageController = new MessageController();
  const proposalController = new ProposalController();
  const nodeController = new NodeController();

  router.use("/status", (req, res) => {
    res.json({ message: "Up and Running" });
  });
  router.use("/blocks", blockController.router);
  router.use("/delegators", delegatorController.router);
  router.use("/validators", validatorController.router);
  router.use("/explorer", explorerController.router);
  router.use("/transactions", transactionsController.router);
  router.use("/contracts", contractController.router);
  router.use("/session", messageController.router);
  router.use("/tokens", tokenContoller.router);
  router.use("/proposals", proposalController.router);
  router.use("/node", nodeController.router);
  return router;
}
