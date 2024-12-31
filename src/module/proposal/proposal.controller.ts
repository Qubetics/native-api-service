import * as express from "express";
import { Request, Response } from "express";
import { Controller } from "../../interfaces/index";
import * as Helpers from "../../service/index";
import proposalService from "./proposal.service";
import {
  getProposalsValidation,
  getVotersValidation,
  proposalSearchValidation,
  voterSearchingValidation,
} from "./proposal.validation";

const setResponse = Helpers.ResponseHelper;

class ValidatorController implements Controller {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router
      .get("", getProposalsValidation, this.getAllProposals)
      .get("/searching", proposalSearchValidation, this.searchingProposals)
      .get("/id/:proposalId", this.getProposalById)
      .get("/voters", getVotersValidation, this.getVotersById)
      .get("/voters/searching", voterSearchingValidation, this.searchingVoters);
  }

  /**
   * get all proposals and their details
   * @param request
   * @param response
   * @returns
   */
  private getAllProposals = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
      status: <string>request.query?.status,
    };

    const res = await proposalService.getAllProposals(data);

    if (res.error) {
      return setResponse.error(response, res);
    }
    return setResponse.success(response, res);
  };

  private getProposalById = async (request: Request, response: Response) => {
    const proposalId = await proposalService.getProposalById(
      request.params?.proposalId,
    );

    if (proposalId.error) {
      return setResponse.error(response, proposalId);
    }
    return setResponse.success(response, proposalId);
  };

  /**
   * get all voters and their details
   * @param request
   * @param response
   * @returns
   */
  private getVotersById = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
      answer: <string>request.query?.answer,
      proposalId: <string>request.query?.proposalId,
    };

    const res = await proposalService.getVotersById(data);

    if (res.error) {
      return setResponse.error(response, res);
    }
    return setResponse.success(response, res);
  };

  /**
   * search voters  by voter address
   * @param request
   * @param response
   * @returns
   */
  private searchingVoters = async (request: Request, response: Response) => {
    const data = {
      address: <string>request.query?.address,
      proposalId: <string>request.query?.proposalId,
    };
    const serachingRes = await proposalService.searchVoterByAddress(data);

    if (serachingRes.error) {
      return setResponse.error(response, serachingRes);
    }
    return setResponse.success(response, serachingRes);
  };

  /**
   * search proposals  by id  and title
   * @param request
   * @param response
   * @returns
   */
  private searchingProposals = async (request: Request, response: Response) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
      value: <string>request.query?.value,
      status: <string>request.query?.status,
    };

    const serachingRes = await proposalService.searchingProposals(data);

    if (serachingRes.error) {
      return setResponse.error(response, serachingRes);
    }
    return setResponse.success(response, serachingRes);
  };
}
export default ValidatorController;
