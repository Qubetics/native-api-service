import * as express from "express";
import nodeService from "./node.service";
import { Request, Response } from "express";
import * as Helpers from "../../service/index";
import { Controller } from "../../interfaces/index";

const setResponse = Helpers.ResponseHelper;

class NodeController implements Controller {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`/all-nodes`, this.getAllNodes);
    this.router.get("", this.getNodeDetails);
    this.router.get("/nodes-performance", this.getNodesPerformance);
    this.router.get("/nodes-summary", this.getNodesSummary);
    this.router.get("/node-detail-summary", this.getNodeDetailSummary);
  }

  /**
   * fetch all node data
   * @param request
   * @param response
   * @returns
   */
  private getAllNodes = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 1 : Number(request.query.page),
      limit: !request.query?.limit ? 10 : Number(request.query.limit),
      reverse: request.query?.reverse === "true",
    };

    const nodeList = await nodeService.getAllNodes(data);

    if (nodeList.error) {
      return setResponse.error(response, nodeList);
    }
    return setResponse.success(response, nodeList);
  };

  /**
   * fetch all node deatils
   * @param request
   * @param response
   * @returns
   */
  private getNodeDetails = async (request: Request, response: Response) => {
    const address: any = request.query?.address || "";
    const page = !request.query?.page ? 0 : Number(request.query.page) - 1;
    const limit = !request.query?.limit ? 10 : Number(request.query.limit);

    const nodeList = await nodeService.getNodeDetails(address, page, limit);

    if (nodeList.error) {
      return setResponse.error(response, nodeList);
    }
    return setResponse.success(response, nodeList);
  };

  /**
   * fetch all nodes performance
   * @param request
   * @param response
   * @returns
   */
  private getNodesPerformance = async (
    request: Request,
    response: Response,
  ) => {
    console.log(request.query, "request.query!!!!");

    const nodeList = await nodeService.getNodesPerformance();

    if (nodeList.error) {
      return setResponse.error(response, nodeList);
    }
    return setResponse.success(response, nodeList);
  };

  /**
   * fetch all nodes summary
   * @param request
   * @param response
   * @returns
   */
  private getNodesSummary = async (request: Request, response: Response) => {
    const nodeList = await nodeService.getNodesSummary();

    if (nodeList.error) {
      return setResponse.error(response, nodeList);
    }
    return setResponse.success(response, nodeList);
  };

  /**
   * fetch node detail summary
   * @param request
   * @param response
   * @returns
   */
  private getNodeDetailSummary = async (
    request: Request,
    response: Response,
  ) => {
    const address: any = request.query?.address || "";

    const nodeList = await nodeService.getNodeDetailSummary(address);

    if (nodeList.error) {
      return setResponse.error(response, nodeList);
    }
    return setResponse.success(response, nodeList);
  };
}

export default NodeController;
