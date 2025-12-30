import * as express from "express";
import dvpnService from "./dvpn.service";
import { Request, Response } from "express";
import * as Helpers from "../../service/index";
import { Controller } from "../../interfaces/index";

const setResponse = Helpers.ResponseHelper;

class DvpnController implements Controller {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/account-summary", this.getAccountSummary);
    this.router.get("/accounts", this.getAccountList);
    this.router.get("/accounts/active-users", this.getActiveAccounts);
    this.router.get("/analytics", this.getNetworkAnalytics);
    this.router.get("", this.getAddressDetails);
    this.router.get("/node", this.getNodeEarning);
  }

  /**
   * fetch all account summary
   * @param request
   * @param response
   * @returns
   */
  private getAccountSummary = async (request: Request, response: Response) => {
    const nodeSummary = await dvpnService.getAccountSummary();

    if (nodeSummary.error) {
      return setResponse.error(response, nodeSummary);
    }
    return setResponse.success(response, nodeSummary);
  };

  /**
   * fetch all dvpn account list
   * @param request
   * @param response
   * @returns
   */
  private getAccountList = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query.limit),
      orderBy: request.query?.orderBy === "asc" ? "asc" : "desc",
    };
    const accountList = await dvpnService.getAccountList(data);

    if (accountList.error) {
      return setResponse.error(response, accountList);
    }
    return setResponse.success(response, accountList);
  };

  /**
   * fetch all dvpn active account list
   * @param request
   * @param response
   * @returns
   */
  private getActiveAccounts = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 1 : Number(request.query.page),
      limit: !request.query?.limit ? 10 : Number(request.query.limit),
      reverse: request.query?.reverse === "true",
    };
    const activeAccounts = await dvpnService.getActiveAccounts(data);

    if (activeAccounts.error) {
      return setResponse.error(response, activeAccounts);
    }
    return setResponse.success(response, activeAccounts);
  };

  private getNetworkAnalytics = async (
    request: Request,
    response: Response,
  ) => {
    const activeAccounts = await dvpnService.getNetworkAnalytics();

    if (activeAccounts.error) {
      return setResponse.error(response, activeAccounts);
    }
    return setResponse.success(response, activeAccounts);
  };
  private getAddressDetails = async (request: Request, response: Response) => {
    const address = request.query?.address || "";

    const activeAccounts = await dvpnService.getAddressDetails(address);

    if (activeAccounts.error) {
      return setResponse.error(response, activeAccounts);
    }
    return setResponse.success(response, activeAccounts);
  };
  private getNodeEarning = async (request: Request, response: Response) => {
    const address = request.query?.address || "";

    const activeAccounts = await dvpnService.getNodeDetails(address);

    if (activeAccounts.error) {
      return setResponse.error(response, activeAccounts);
    }
    return setResponse.success(response, activeAccounts);
  };
}

export default DvpnController;
