import {
  REDIS_KEY,
  RES_MSG,
  CONST_NAME,
  FETCH_METHODS,
  HEADERS,
  CURRENT_DEFAULT_APR,
  CURRENT_DEFAULT_COIN_PRICE,
  CURRENT_DEFAULT_CIRCULATING_SUPPLY,
  STATIC_BURNED_AMOUNT,
} from "../../constant";
import { GraphData, IESResponse, IGraphResponse } from "../../interfaces/index";
import { calculateData } from "../../helper/calculateAPR.helper";
import logger from "../../lib/logger";
import { RedisService } from "../../service";
import blockService from "../block/block.service";
import transactionService from "../transactions/transaction.service";
import prisma from "../../lib/db";
import { fetchRequest } from "../../Utility/common";
import {
  formatDate,
  fillMissingDatesWithZeroByhr,
  formatDateForDay,
  fillMissingDatesWithZeroByDay,
  formatDateByMin,
  fillMissingMinutes,
  exp,
  formatDateBySec,
  fillMissingSeconds,
  formatDateForYear,
  fillMissingDatesWithZeroByMonth,
} from "../../lib/utilities.helper";
import contractService from "../contract/contract.service";
import nodeService from "../node/node.service";
import redisHelper from "../../service/redis.helper";
import axios from "axios";
import { calculateSupplyDetails } from "../../helper/common.helper";

class ExplorerService {
  // Method to get data from Redis
  getRedisValue = async (): Promise<
    | {
      tokenPrice: number;
      marketCap: number;
      apy: number;
      totalSupply: number;
      inflation: number;
      totalValidator: number;
      circulation_supply: number;
    }
    | false
  > => {
    try {
      // Fetch values from Redis for different keys
      let tokenPrice = await RedisService.getString(REDIS_KEY.COIN_PRICE);
      tokenPrice = tokenPrice === null ? 0 : tokenPrice;

      let marketCap = await RedisService.getString(REDIS_KEY.MARKET_CAP);
      marketCap = marketCap === null ? 0 : marketCap;

      const circulationsupply = calculateSupplyDetails();
      const circulation_supply = circulationsupply.circulating_supply;

      let totalSupply = await RedisService.getString(REDIS_KEY.TOTAL_SUPPLY);

      let validatorData = await RedisService.getString(REDIS_KEY.INFLATION_APY);
      validatorData = validatorData === null ? {} : JSON.parse(validatorData);

      // Extract necessary values from the validatorData object
      const { apy, inflation, totalValidator } = validatorData;
      return {
        tokenPrice,
        marketCap,
        apy: Number(apy),
        totalSupply: totalSupply,
        inflation: Number(inflation) * 100,
        totalValidator: Number(totalValidator),
        circulation_supply,
      };
    } catch (err) {
      logger.error("Error while getting value  from redis ", err);
      return false;
    }
  };

  async searching(payload: string): Promise<IESResponse> {
    try {
      // const txData = await transactionService.activeSearchResults(payload);
      // return txData;
      let txData;

      if (!payload.startsWith("0x") && !isNaN(Number(payload))) {
        const result = await blockService.getBlockByNumber(Number(payload));
        return result;
      } else if (payload?.startsWith("0x") && payload?.length === 66) {
        // Handle transaction hash with '0x'
        const txData = await transactionService.getTransactionByHash(payload);
        if (txData?.error) {
          const result = await blockService.getBlockByHash(payload);
          if (result?.error) result.message = RES_MSG.NOT_FOUND;
          return result;
        }

        return txData;
        // } else if (
        // 	payload?.length === 64 &&
        // 	!payload.startsWith('0x') &&
        // 	!payload.startsWith('qubetics')
        // ) {
        // 	// If the payload length is 64 and it doesn't start with '0x', prepend '0x'
        // 	payload = '0x' + payload;

        // 	// Call getTransactionByHash with the modified payload
        // 	txData = await transactionService.getTransactionByHash(payload);
        // 	return txData;
      } else if (
        payload.startsWith("qubetics") &&
        payload.length > 42 &&
        payload.length <= 50
      ) {
        /* here we search for all transaction specfic to a wallet address*/
        txData = await this.getUserByAddress(payload);
        return txData;
      } else if (payload.startsWith("qubetics") && payload.length === 64) {
        /* here we search for all transaction specfic to a wallet address*/
        txData = await contractService.getContractByAddress(payload);

        return txData;
      } else if (payload.startsWith("qubeticsnode") && payload.length === 51) {
        txData = await nodeService.getNodeAddressSearch(payload);
        return txData;
      } else {
        throw new Error(RES_MSG.NOT_FOUND);
      }
    } catch (err) {
      if (err instanceof Error) {
        return { error: true, message: RES_MSG.NOT_FOUND };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getAccountCounts(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData;
      let finalData;

      let startDate = "";

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          const currentDate = new Date();

          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
          startDate = formatDate(oneDayAgo);
          graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
					FROM "Users"
					WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
			
					GROUP BY "hour"
					ORDER BY "hour";
					`) as Array<{ hour: Date; count: number }>;

          finalData = await fillMissingDatesWithZeroByhr(
            graphData,
            new Date(startDate),
          );
        } else {
          const currentDate = new Date();

          const daysAgo = payloads.interval;
          const fromDate = new Date(currentDate);
          fromDate.setDate(fromDate.getDate() - daysAgo);
          startDate = formatDateForDay(fromDate);

          graphData = (await prisma.$queryRaw`
				  SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				  FROM "Users"
				  WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					
				  GROUP BY "day"
				  ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

          finalData = await fillMissingDatesWithZeroByDay(
            graphData,
            new Date(startDate),
            currentDate,
          );
        }
      } else if (payloads.time === "h") {
        const currentDate = formatDateByMin(new Date());

        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - payloads.interval);
        startDate = formatDateByMin(oneHourAgo);
        const graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Users"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${new Date(currentDate)}
				
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

        finalData = await fillMissingMinutes(
          graphData,
          new Date(startDate),
          new Date(currentDate),
        );
      } else if (payloads.time === "y" && payloads.interval === 1) {
        const currentDate = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
        startDate = formatDateForYear(oneYearAgo);

        graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
				FROM "Users"
				WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				GROUP BY "month"
				ORDER BY "month";
			`) as Array<{ month: Date; count: number }>;

        finalData = await fillMissingDatesWithZeroByMonth(
          graphData,
          new Date(startDate),
          currentDate,
        );
      }

      let totalAccount = await RedisService.getString(
        REDIS_KEY.TOTAL_ACCOUNTS,
      );

      if (!totalAccount) {
        totalAccount = (await prisma.users.count()).toString();
        await RedisService.setStringWithExpiry(
          REDIS_KEY.TOTAL_ACCOUNTS,
          totalAccount,
          300,
        );
      }

      return {
        error: false,
        message: RES_MSG.ACCOUNT_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: Number(totalAccount),
        },
      };
    } catch (err) {
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getContractDeployedCount(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData;
      let finalData;
      let startDate = "";

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          const currentDate = new Date();

          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
          startDate = formatDate(oneDayAgo);

          graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "hour"
				   ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
          finalData = await fillMissingDatesWithZeroByhr(
            graphData,
            new Date(startDate),
          );
        } else {
          const currentDate = new Date();

          const daysAgo = payloads.interval;
          const fromDate = new Date(currentDate);
          fromDate.setDate(fromDate.getDate() - daysAgo);
          startDate = formatDateForDay(fromDate);

          graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

          finalData = await fillMissingDatesWithZeroByDay(
            graphData,
            new Date(startDate),
            currentDate,
          );
        }
      } else if (payloads.time === "h") {
        const currentDate = new Date();
        const currentDateModi = formatDateByMin(new Date());
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - payloads.interval);
        startDate = formatDateByMin(oneHourAgo);
        graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
        finalData = await fillMissingMinutes(
          graphData,
          new Date(startDate),
          new Date(currentDateModi),
        );
      } else if (payloads.time === "y" && payloads.interval === 1) {
        const currentDate = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
        startDate = formatDateForYear(oneYearAgo);

        graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				AND "type" = 'CONTRACT_CREATION'
				GROUP BY "month"
				ORDER BY "month";
			`) as Array<{ month: Date; count: number }>;

        finalData = await fillMissingDatesWithZeroByMonth(
          graphData,
          new Date(startDate),
          currentDate,
        );
      }

      let contractsCount: number;
      const cachedContractsCount = await RedisService.getString(REDIS_KEY.CONTRACTS_COUNT);
      if (cachedContractsCount && !Array.isArray(cachedContractsCount)) {
        contractsCount = Number(cachedContractsCount);
      } else {
        contractsCount = await prisma.contracts.count();
        RedisService.setStringWithExpiry(REDIS_KEY.CONTRACTS_COUNT, contractsCount.toString(), 300).catch(
          (e) => logger.error("Cache write error for CONTRACTS_COUNT", e),
        );
      }

      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: contractsCount,
        },
      };
    } catch (err) {
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getAddressDetail(address: string): Promise<IESResponse> {
    try {
      const user = await prisma.users.findFirst({
        where: {
          address: address,
        },
        select: {
          txn: true,
        },
      });

      let txnCount = user ? user.txn : "";

      const userBalanceCacheKey = `${REDIS_KEY.USER_BALANCE}:${address}`;
      let userBalance = await RedisService.getString(userBalanceCacheKey);
      if (!userBalance || Array.isArray(userBalance)) {
        try {
          const response = await fetchRequest(
            `${environment.evmHost}/cosmos/bank/v1beta1/spendable_balances/${address}`,
            FETCH_METHODS.GET,
            HEADERS.DEFAULT,
          );

          const qubeticsAmount = response.data?.balances?.find(
            (item: any) => item.denom === "tics",
          );

          userBalance = qubeticsAmount?.amount ?? "";

          if (userBalance) {
            RedisService.setStringWithExpiry(userBalanceCacheKey, userBalance, 30).catch(
              (e) => logger.error("Cache write error for USER_BALANCE", e),
            );
          }
        } catch (error) {
          logger.error("balance fetch error", error);
          userBalance = "";
        }
      }
      const actualBalance = userBalance
        ? (Number(userBalance) / Math.pow(10, 18)).toString()
        : "";

      let marketCapPrice = await RedisService.getString(
        CONST_NAME.MARKET_CAP_PRICE,
      );
      let value: string;
      if (!marketCapPrice) {
        const latestEntry = await prisma.coinmarketInfo.findFirst({
          orderBy: { id: "desc" },
          select: { price: true },
        });

        const price = latestEntry?.price?.toString() ?? "";
        value = price ? (Number(price) * Number(actualBalance)).toString() : "";
      } else {
        value =
          marketCapPrice?.price && actualBalance
            ? (Number(marketCapPrice?.price) * Number(actualBalance)).toString()
            : "";
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          coinBalance: exp(actualBalance),
          value: exp(value),
          transactionCount: Number(txnCount),
        },
      };
    } catch (err) {
      logger.error("error in getAddressDetail", err);

      return {
        error: true,
        message: err instanceof Error ? err.message : RES_MSG.ERROR,
      };
    }
  }

  async tpsHistory(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData;
      let finalData;
      let startDate = "";

      const currentDate = new Date();

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          const currentDate = new Date();

          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
          startDate = formatDate(oneDayAgo);
          graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
		
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

          finalData = await fillMissingDatesWithZeroByhr(
            graphData,
            new Date(startDate),
          );
        } else {
          const currentDate = new Date();

          const daysAgo = payloads.interval;
          const fromDate = new Date(currentDate);
          fromDate.setDate(fromDate.getDate() - daysAgo);
          startDate = formatDateForDay(fromDate);

          graphData = (await prisma.$queryRaw`
			  SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
			  FROM "Transactions"
			  WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				
			  GROUP BY "day"
			  ORDER BY "day";
			`) as Array<{ day: Date; count: number }>;

          finalData = await fillMissingDatesWithZeroByDay(
            graphData,
            new Date(startDate),
            currentDate,
          );
        }
      } else if (payloads.time === "y" && payloads.interval === 1) {
        const currentDate = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
        startDate = formatDateForYear(oneYearAgo);

        graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				GROUP BY "month"
				ORDER BY "month";
			`) as Array<{ month: Date; count: number }>;

        finalData = await fillMissingDatesWithZeroByMonth(
          graphData,
          new Date(startDate),
          currentDate,
        );
      }
      const totalTx = await RedisService.getString(REDIS_KEY.TOTAL_TX);
      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: finalData
            ? finalData.reduce((total, data) => total + (data.count || 0), 0)
            : 0,
        },
      };
    } catch (err) {
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getUserByAddress(address: string): Promise<IESResponse> {
    try {
      const user = await prisma.users.findFirst({
        where: {
          address: address,
        },
        select: {
          address: true,
        },
      });

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          addresses: user,
        },
      };
    } catch (err) {
      logger.error("error in getUserByAddress", err);

      return {
        error: true,
        message: err instanceof Error ? err.message : RES_MSG.ERROR,
      };
    }
  }

  async dashboard(): Promise<IESResponse> {
    try {
      const [
        cachedCalcData,
        latestBlock,
        transactionCount,
        marketCapCached,
        tokenPriceCached,
        userCountCached,
        burnedAmountCached,
        totalSupplyCached,
      ] = await Promise.all([
        RedisService.getString(REDIS_KEY.EXPLORER_CALCULATE_DATA),
        RedisService.getString(REDIS_KEY.LATEST_BLOCK),
        RedisService.getString(REDIS_KEY.NATIVE_TRANSACTIONS_COUNT),
        RedisService.getString(REDIS_KEY.MARKET_CAP),
        RedisService.getString(REDIS_KEY.COIN_PRICE),
        RedisService.getString(REDIS_KEY.TOTAL_ACCOUNTS),
        RedisService.getString(REDIS_KEY.TOTAL_BURNED_AMOUNT),
        RedisService.getString(REDIS_KEY.TOTAL_SUPPLY),
      ]);

      let data: any;
      if (cachedCalcData && !Array.isArray(cachedCalcData)) {
        data = typeof cachedCalcData === "string"
          ? JSON.parse(cachedCalcData)
          : cachedCalcData;
      } else {
        data = await calculateData();
        RedisService.setStringWithExpiry(
          REDIS_KEY.EXPLORER_CALCULATE_DATA,
          JSON.stringify(data),
          60,
        ).catch((e) => logger.error("Cache write error for EXPLORER_CALCULATE_DATA", e));
      }

      const tokenPrice = tokenPriceCached ?? CURRENT_DEFAULT_COIN_PRICE;

      const supplyDetails = calculateSupplyDetails();
      const circulationSupply = supplyDetails.circulating_supply;

      let marketCap = marketCapCached;
      if (marketCap === "0" || !marketCap) {
        marketCap = (Number(tokenPrice) * circulationSupply).toString();
      }

      let userCount = Number(userCountCached);
      if (!userCountCached) {
        userCount = await prisma.users.count();
        await RedisService.setStringWithExpiry(
          REDIS_KEY.TOTAL_ACCOUNTS,
          userCount.toString(),
          300, // 5 minutes cache
        );
      }

      let burnedAmount = burnedAmountCached;
      if (!burnedAmount) {
        burnedAmount = (await this.calculateBurnedAmount()).toString();
      }

      let totalSupply = totalSupplyCached;
      if (!totalSupply) {
        const supplyRes = await this.getTotalSupply();
        totalSupply = (supplyRes.data as any)?.totalSupply?.toString();
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          apy: CURRENT_DEFAULT_APR,
          inflation: (data as any).inflation,
          totalValidator: (data as any).totalValidator,
          circulation_supply: circulationSupply,
          apr: (data as any)?.apr
            ? Number((data as any)?.apr)
            : CURRENT_DEFAULT_APR,
          tokenPrice: Number(tokenPrice),
          validators: (data as any)?.validator ?? 0,
          circulationSupply: circulationSupply,
          latest_block: latestBlock,
          total_transactions: transactionCount,
          total_accounts: userCount,
          bondedTokens: (data as any)?.bondedTokens
            ? Number((data as any).bondedTokens)
            : 0,
          bondedRate: (data as any)?.bondedRate,
          marketCap,
          community_pool: (data as any)?.community_pool ?? 0,
          burnedAmount,
        },
      };
    } catch (err) {
      logger.error("Error in dashboard data:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async getTotalSupply(): Promise<IESResponse> {
    try {
      let totalSupply = await RedisService.getString(REDIS_KEY.TOTAL_SUPPLY);

      if (!totalSupply) {
        /** save burned fees */

        let burnedAmount = await RedisService.getString(
          REDIS_KEY.TOTAL_BURNED_AMOUNT,
        );

        if (!burnedAmount) {
          burnedAmount = await this.calculateBurnedAmount();
        }

        const { initialSupply } = environment;
        const totalSupply = initialSupply - burnedAmount;
        await redisHelper.setString(REDIS_KEY.TOTAL_SUPPLY, totalSupply);
      }

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          totalSupply,
        },
      };
    } catch (err) {
      logger.error("dashboard-Error", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async getBurnedAmount(): Promise<IESResponse> {
    try {
      let burnedAmount = await RedisService.getString(
        REDIS_KEY.TOTAL_BURNED_AMOUNT,
      );

      if (!burnedAmount) {
        /** save burned fees */
        burnedAmount = await this.calculateBurnedAmount();
        await redisHelper.setString(
          REDIS_KEY.TOTAL_BURNED_AMOUNT,
          burnedAmount,
        );
      }

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          burnedAmount,
        },
      };
    } catch (err) {
      logger.error("dashboard-Error", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async calculateBurnedAmount() {
    try {
      const burnedAmountResult = await prisma.transactions.aggregate({
        _sum: {
          burnedFee: true,
        },
      });

      const totalBurned =
        Number(burnedAmountResult?._sum.burnedFee || 0) +
        Number(STATIC_BURNED_AMOUNT);

      await RedisService.setStringWithExpiry(
        REDIS_KEY.TOTAL_BURNED_AMOUNT,
        totalBurned.toString(),
        600, // 10 minutes cache
      );

      return totalBurned;
    } catch (error) {
      logger.error("error in calculateBurnedAmount", error);
      return Number(STATIC_BURNED_AMOUNT);
    }
  }

  async getCirculationSupply(): Promise<IESResponse> {
    try {
      const supplyDetails = calculateSupplyDetails();
      const circulatingSupply = supplyDetails.circulating_supply;
      // const circulationSupplyUrl = environment.nativeAPIUrl;
      // const result = await axios.get(
      // 	circulationSupplyUrl + '/explorer/circulation-supply',
      // );

      // circulationSupply = result?.data?.data?.circulationSupply;

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          circulatingSupply,
        },
      };
    } catch (err) {
      logger.error("dashboard-Error", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }
}

export default new ExplorerService();
