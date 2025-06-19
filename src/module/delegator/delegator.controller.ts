import * as express from "express";
import { Request, Response } from "express";
import * as Helpers from "../../service/index";
import delegatorService from "./delegator.service";
import { Controller } from "../../interfaces/index";
import { getBlocksValidation } from "../block/block.validation";
import { delegatorByAddressValidation } from "./delegator.validation";

const setResponse = Helpers.ResponseHelper;

class DelegatorController implements Controller {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router
      .get("", getBlocksValidation, this.getAllDelegators)
      .get(
        "/:address",
        delegatorByAddressValidation,
        this.getDelegatorByAddress,
      )
      .get("/dashboard/:delegatorAddress", this.dashboard);
  }

  private getAllDelegators = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
    };

    const res = await delegatorService.getAllDelegators(data);

    if (res.error) {
      return setResponse.error(response, res);
    }
    return setResponse.success(response, res);
  };

  private getDelegatorByAddress = async (
    request: Request,
    response: Response,
  ) => {
    const blockDetails = await delegatorService.getDelegatorByAddress(
      request.params?.address as string,
    );
    if (blockDetails.error) {
      return setResponse.error(response, blockDetails);
    }
    return setResponse.success(response, blockDetails);
  };

  private dashboard = async (request: Request, response: Response) => {
    const dashboard = await delegatorService.dashboard(
      request.params?.delegatorAddress as string,
    );

    if (dashboard.error) {
      return setResponse.error(response, dashboard);
    }
    return setResponse.success(response, dashboard);
  };
}

export default DelegatorController;
