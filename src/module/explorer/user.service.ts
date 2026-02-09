import prisma from "../../lib/db";
import { IESResponse } from "../../interfaces";
import {
  RES_MSG,
  REDIS_KEY,
  FETCH_METHODS,
  HEADERS,
  CONST_NAME,
} from "../../constant";
import { RedisService } from "../../service";
import { fetchRequest } from "../../Utility/common";
import { exp } from "../../lib/utilities.helper";
import logger from "../../lib/logger";

class UserService {
  async getUserByAddress(address: string): Promise<IESResponse> {
    try {
      const user = await prisma.users.findFirst({
        where: { address },
        select: { address: true },
      });
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: { addresses: user },
      };
    } catch (err) {
      logger.error("Error in getUserByAddress:", err);
      return {
        error: true,
        message: err instanceof Error ? err.message : RES_MSG.ERROR,
      };
    }
  }

  async getAddressDetail(address: string): Promise<IESResponse> {
    try {
      const [user, marketCapPrice] = await Promise.all([
        prisma.users.findFirst({
          where: { address },
          select: { txn: true },
        }),
        RedisService.getString(CONST_NAME.MARKET_CAP_PRICE),
      ]);

      let userBalance = "";
      try {
        const response = await fetchRequest(
          `${environment.evmHost}/cosmos/bank/v1beta1/spendable_balances/${address}`,
          FETCH_METHODS.GET,
          HEADERS.DEFAULT,
        );
        const qubeticsAmount = response.data?.balances.find(
          (item: any) => item.denom === "tics",
        );
        userBalance = qubeticsAmount?.amount || "0";
        await RedisService.setString(REDIS_KEY.USER_BALANCE, userBalance);
      } catch (error) {
        logger.error("Balance fetch error:", error);
      }

      const actualBalance = userBalance
        ? (Number(userBalance) / Math.pow(10, 18)).toString()
        : "0";
      let value = "0";

      if (!marketCapPrice) {
        const latestEntry = await prisma.coinmarketInfo.findFirst({
          orderBy: { id: "desc" },
          select: { price: true },
        });
        const price = latestEntry?.price?.toString() || "0";
        value = (Number(price) * Number(actualBalance)).toString();
      } else {
        const price = (marketCapPrice as any)?.price || "0";
        value = (Number(price) * Number(actualBalance)).toString();
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          coinBalance: exp(actualBalance),
          value: exp(value),
          transactionCount: Number(user?.txn || 0),
        },
      };
    } catch (err) {
      logger.error("Error in getAddressDetail:", err);
      return {
        error: true,
        message: err instanceof Error ? err.message : RES_MSG.ERROR,
      };
    }
  }
}

export default new UserService();
