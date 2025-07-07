import * as express from "express";
import { Request, Response } from "express";
import { Controller } from "../../interfaces/index";
import * as Helpers from "../../service/index";
import transactionService from "./transaction.service";
import {
  getTransactionsValidation,
  getTxByBlock,
  getTxByHashValidation,
  transactionSearch,
  updateTransactionValidation,
} from "./transaction.validation";

const setResponse = Helpers.ResponseHelper;

class TransactionController implements Controller {
  public router = express.Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router
      .get("", getTransactionsValidation, this.getAllTransactions)
      .get("/address", transactionSearch, this.getTransactionsByAddress)
      .get(
        "/hash/:transactionHash",
        getTxByHashValidation,
        this.getTransactionByHash,
      )
      .get("/block", getTxByBlock, this.getTransactionByBlock)

      .put(
        "/update/:transactionHash",
        updateTransactionValidation,
        this.updateTransaction,
      );
  }

  /**
   * get all transactions and their details
   * @param request
   * @param response
   * @returns
   */
  private getAllTransactions = async (request: Request, response: Response) => {
    // const data = {
    //   page: request.query?.page ? Number(request.query?.page) : 1,
    //   limit: !request.query?.limit ? 10 : Number(request.query?.limit),
    // };

    const data = {
      page: request.query?.page ? Number(request.query?.page) : 1,
      order: request.query?.order ? request.query?.order : "desc",
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
    };
    const res = await transactionService.getAllTransactions(data);

    if (res.error) {
      return setResponse.error(response, res);
    }
    return setResponse.success(response, res);
  };

  /**
   * get transaction by address
   * @param address
   * @returns
   */
  private getTransactionsByAddress = async (
    request: Request,
    response: Response,
  ) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query?.limit),
      address: <string>request.query?.address,
    };

    const res = await transactionService.getTransactionsByAddress(data);

    if (res.error) {
      return setResponse.error(response, res);
    }
    return setResponse.success(response, res);
  };

  private getTransactionByHash = async (
    request: Request,
    response: Response,
  ) => {
    const transactionByHash = await transactionService.getTransactionByHash(
      request.params?.transactionHash,
    );

    if (transactionByHash.error) {
      return setResponse.error(response, transactionByHash);
    }
    return setResponse.success(response, transactionByHash);
  };

  private getTransactionByBlock = async (
    request: Request,
    response: Response,
  ) => {
    const data = {
      page: !request.query?.page ? 0 : Number(request.query.page) - 1,
      limit: !request.query?.limit ? 10 : Number(request.query.limit),
      value: !request.query.value ? "" : <string>request.query.value,
    };
    const transactionByBlock =
      await transactionService.getTransactionByBlock(data);

    if (transactionByBlock.error) {
      return setResponse.error(response, transactionByBlock);
    }
    return setResponse.success(response, transactionByBlock);
  };

  /**
   * Update a transaction by txhash
   * @param request
   * @param response
   * @returns
   */

  private updateTransaction = async (request: Request, response: Response) => {
    const transactionHash = request.params?.transactionHash; // Assuming txhash is passed as a route parameter
    const transactionData = request.body;
    const updatedTransaction = await transactionService.updateTransaction(
      transactionHash,
      transactionData,
    );

    if (updatedTransaction.error) {
      return setResponse.error(response, updatedTransaction);
    }
    return setResponse.success(response, updatedTransaction);
  };
}

export default TransactionController;
