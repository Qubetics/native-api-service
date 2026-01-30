import { RedisService } from "../../service";
import {
  REDIS_KEY,
  RES_MSG,
  CONST_NAME,
  STATIC_BURNED_AMOUNT,
} from "../../constant";
import { IESResponse } from "../../interfaces";
import prisma from "../../lib/db";
import logger from "../../lib/logger";
import axios from "axios";
import { calculateSupplyDetails } from "../../helper/common.helper";

class SupplyService {
  async getCirculationSupply(): Promise<IESResponse> {
    try {
             const circulationSupply =  calculateSupplyDetails();

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: circulationSupply,
      };
    } catch (err) {
      logger.error("Error in getCirculationSupply:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async getTotalSupply(): Promise<IESResponse> {
    try {
      let totalSupply = await RedisService.getString(REDIS_KEY.TOTAL_SUPPLY);
      if (!totalSupply) {
        let burnedAmount = await RedisService.getString(
          REDIS_KEY.TOTAL_BURNED_AMOUNT,
        );
        if (!burnedAmount) {
          burnedAmount = (await this.calculateBurnedAmount()).toString();
        }
        const { initialSupply } = global.environment;
        const totalSupplyValue = initialSupply - Number(burnedAmount);
        await RedisService.setString(
          REDIS_KEY.TOTAL_SUPPLY,
          totalSupplyValue.toString(),
        );
        totalSupply = totalSupplyValue.toString();
      }
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          totalSupply: Number(totalSupply),
        },
      };
    } catch (err) {
      logger.error("Error in getTotalSupply:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async calculateCirculatingSupply(): Promise<number> {
    try {

      const returnValue = calculateSupplyDetails();
      const supply = returnValue.circulating_supply;
      
      return supply;
    } catch (err) {
      logger.error("Error in calculateCirculatingSupply:", err);
      return 0;
    }
  }

  async getBurnedAmount(): Promise<IESResponse> {
    try {
      let burnedAmount = await RedisService.getString(
        REDIS_KEY.TOTAL_BURNED_AMOUNT,
      );
      if (!burnedAmount) {
        burnedAmount = await this.calculateBurnedAmount();
      }
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: burnedAmount,
      };
    } catch (err) {
      logger.error("Error in getBurnedAmount:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async calculateBurnedAmount(): Promise<number> {
    try {
      const result = (await prisma.$queryRaw`
        SELECT SUM("burnedFee") as sum FROM "Transactions"
      `) as Array<{ sum: number | null }>;
      const burnedAmount = (result[0]?.sum || 0).toString();
      await RedisService.setString(REDIS_KEY.TOTAL_BURNED_AMOUNT, burnedAmount);
      return Number(STATIC_BURNED_AMOUNT);
    } catch (err) {
      logger.error("Error in calculateBurnedAmount:", err);
      return Number(STATIC_BURNED_AMOUNT);
    }
  }
}

export default new SupplyService();
