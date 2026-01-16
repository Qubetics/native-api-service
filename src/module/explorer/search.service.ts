import { IESResponse } from "../../interfaces";
import { RES_MSG } from "../../constant";
import blockService from "../block/block.service";
import transactionService from "../transactions/transaction.service";
import contractService from "../contract/contract.service";
import userService from "./user.service";
import validatorService from "../validator/validator.service";
import logger from "../../lib/logger";

class SearchService {
  async searching(payload: string): Promise<IESResponse> {
    try {
      if (!payload.startsWith("0x") && !isNaN(Number(payload))) {
        return await blockService.getBlockByNumber(Number(payload));
      } 
      
      if (payload?.startsWith("0x") && payload?.length === 66) {
        const txData = await transactionService.getTransactionByHash(payload);
        if (txData?.error) {
          const result = await blockService.getBlockByHash(payload);
          if (result?.error) result.message = RES_MSG.NOT_FOUND;
          return result;
        }
        return txData;
      } 
      
      if (payload.startsWith("qubetics")) {
        if (payload.startsWith("qubeticsvaloper")) {
          return await validatorService.getValidatorsByAddress(payload);
        }
        if (payload.length > 42 && payload.length <= 50) {
          return await userService.getUserByAddress(payload);
        } 
        if (payload.length === 64) {
          return await contractService.getContractByAddress(payload);
        }
      }
      
      throw new Error(RES_MSG.NOT_FOUND);
    } catch (err) {
      logger.error("Error in searching:", err);
      return { 
        error: true, 
        message: err instanceof Error ? RES_MSG.NOT_FOUND : RES_MSG.ERROR 
      };
    }
  }
}

export default new SearchService();
