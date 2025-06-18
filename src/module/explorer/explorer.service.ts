import {
  REDIS_KEY,
  RES_MSG,
  CONST_NAME,
  FETCH_METHODS,
  HEADERS,
  CURRENT_DEFAULT_COIN_PRICE,
  CURRENT_DEFAULT_APR,
} from "../../constant";
import { GraphData, IESResponse, IGraphResponse } from "../../interfaces/index";
import {
  calculateData,
  getDashboardData,
} from "../../helper/calculateAPR.helper";
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
  formatDateForYear,
  fillMissingDatesWithZeroByMonth,
} from "../../lib/utilities.helper";
import contractService from "../contract/contract.service";
import { validate } from "uuid";

class ExplorerService {
  // Dashboard method to fetch data
  async dashboard(): Promise<any> {
    try {
      // Initialize an object to store data
      const obj: {
        tokenPrice: number;
        marketCap: number;
        apy: number;
        totalSupply: number;
        inflation: number;
        totalValidator: number;
        circulation_supply: number;
        latest_block: number;
        total_transactions: number;
        total_accounts: number;
        apr: number;
      } = {
        tokenPrice: 0,
        marketCap: 0,
        apy: 0,
        totalSupply: 0,
        inflation: 0,
        totalValidator: 0,
        circulation_supply: 0,
        latest_block: 0,
        total_transactions: 0,
        total_accounts: 0,
        apr: CURRENT_DEFAULT_APR, //will be changed after mainnet
      };

      const [latest_block, transactionCount, userCount] = await Promise.all([
        fetchRequest(`${environment.httpHost}/block`, "GET", null),
        prisma.transactions.count(),
        prisma.users.count(),
      ]);
      obj.tokenPrice = CURRENT_DEFAULT_COIN_PRICE;
      const data = await calculateData();

      const marketCap =
        "circulation_supply" in data
          ? data?.circulation_supply * obj?.tokenPrice
          : CONST_NAME.ZERO;

      if (
        "apy" in data &&
        "inflation" in data &&
        "totalSupply" in data &&
        "totalValidator" in data &&
        "circulation_supply" in data
      ) {
        return {
          error: false,
          message: RES_MSG.FETCH_SUCCESS,
          data: {
            apy: data.apy,
            inflation: data.inflation,
            totalSupply: data.totalSupply,
            totalValidator: data.totalValidator,
            circulation_supply: data.circulation_supply,
            latest_block: Number(
              latest_block?.data.result.block?.header?.height
            ),
            total_transactions: transactionCount,
            total_accounts: userCount,
            validators: data?.totalValidator,
            tokenPrice: obj?.tokenPrice,
            // marketCap: marketCap,
            marketCap: 1004025491.35402,
            circulationSupply: data?.circulation_supply ?? 0,
            apr: data?.apr ?? CURRENT_DEFAULT_APR, //will be changed after mainnet
          },
        };
      }

      // Fetch data from Redis
      const redisData: any = await this.getRedisValue();
      console.log("redisData", redisData);
      const hasInvalidValues: boolean = await this.hasInvalidValues(redisData);

      let validatorData = await RedisService.getString(
        REDIS_KEY.VALIDATOR_DATA
      );

      // Check if Redis data is not available
      if (hasInvalidValues) {
        if (validatorData) {
          const exlorerData = JSON.parse(validatorData);
          obj.apy = exlorerData?.apy;
          obj.totalSupply = exlorerData?.totalSupply;
          obj.inflation = exlorerData?.inflation;
          obj.tokenPrice = exlorerData?.tokenPrice;
          obj.marketCap = exlorerData?.marketCap;
          obj.totalValidator = exlorerData?.totalValidator;
          obj.circulation_supply = exlorerData?.circulation_supply;
          obj.latest_block = Number(
            latest_block?.data.result.block?.header?.height
          );
          obj.total_transactions = transactionCount;
          obj.total_accounts = userCount;
          obj.apr = exlorerData?.apr ?? CURRENT_DEFAULT_APR; //will be changed after mainnet

          return {
            error: false,
            message: RES_MSG.FETCH_SUCCESS,
            data: obj,
          };
        } else {
          // Set default values and fetch additional data
          const data = await calculateData();

          const marketCap =
            "circulation_supply" in data
              ? data?.circulation_supply * obj?.tokenPrice
              : CONST_NAME.ZERO;

          if (
            "apy" in data &&
            "inflation" in data &&
            "totalSupply" in data &&
            "totalValidator" in data &&
            "circulation_supply" in data
          ) {
            return {
              error: false,
              message: RES_MSG.FETCH_SUCCESS,
              data: {
                apy: data.apy,
                inflation: data.inflation,
                totalSupply: data.totalSupply,
                totalValidator: data.totalValidator,
                circulation_supply: data.circulation_supply,
                latest_block: Number(
                  latest_block?.data.result.block?.header?.height
                ),
                total_transactions: transactionCount,
                total_accounts: userCount,
                validators: data?.totalValidator,
                tokenPrice: obj?.tokenPrice,
                marketCap: marketCap,
                circulationSupply: data?.circulation_supply ?? 0,
                apr: data?.apr ?? CURRENT_DEFAULT_APR, //will be changed after mainnet
              },
            };
          }
        }
      } else {
        // Use Redis data if available

        obj.apy = redisData?.apy;
        obj.totalSupply = redisData?.totalSupply;
        obj.inflation = redisData?.inflation;
        obj.tokenPrice = redisData?.tokenPrice;
        obj.marketCap = redisData?.marketCap;
        obj.totalValidator = redisData?.totalValidator;
        obj.circulation_supply = redisData?.circulation_supply;
        obj.latest_block = Number(
          latest_block?.data.result.block?.header?.height
        );
        obj.total_transactions = transactionCount;
        obj.total_accounts = userCount;
        obj.apr = redisData?.apr ?? CURRENT_DEFAULT_APR; //will be changed after mainnet

        return {
          error: false,
          message: RES_MSG.FETCH_SUCCESS,
          data: obj,
        };
      }
    } catch (err) {
      logger.error("Error in dashboard data:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async dashboard_V2(): Promise<any> {
    try {
      // const data: any = await calculateData();
      let dashboardData = await RedisService.getString(
        REDIS_KEY.DASHBOARD_DATA
      );

      if (!dashboardData) {
        console.log("dashboardData NOT found in REDIS");
        dashboardData = await getDashboardData();
      } else {
        dashboardData = JSON.parse(dashboardData);
      }

      console.log("THE DASHBOARD DATA", dashboardData);
      function isInvalid(val: string | null | undefined): boolean {
        return val === null || val === undefined || val === "";
      }

      const blockRes = await fetchRequest(
        `${environment.httpHost}/block`,
        "GET",
        null
      );

      const latestBlock = Number(blockRes?.data?.result?.block?.header?.height);

      const latestBlockRedis = await RedisService.getString(
        CONST_NAME.LATEST_BLOCK
      );

      const totalTransactionsRedis = await RedisService.getString(
        REDIS_KEY.NATIVE_TRANSACTIONS_COUNT
      );
      const totalAccountsRedis = await RedisService.getString(
        REDIS_KEY.TOTAL_ACCOUNTS
      );

      const totalTransactions = isInvalid(totalTransactionsRedis)
        ? String(await prisma.transactions.count())
        : totalTransactionsRedis;

      const totalAccounts = isInvalid(totalAccountsRedis)
        ? String(await prisma.users.count())
        : totalAccountsRedis;
      let marketCap = dashboardData?.marketCap;
      if (!dashboardData?.marketCap) {
        marketCap = dashboardData.circulationSupply * dashboardData.tokenPrice;
      }

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          apr: dashboardData.apr,
          validators: dashboardData?.validator ?? 0,
          circulationSupply: dashboardData?.circulationSupply ?? 0,
          latest_block: latestBlock,
          total_transactions: totalTransactions,
          total_accounts: totalAccounts,
          bondedTokens: dashboardData?.bondedTokens ?? 0,
          bondedRate: dashboardData?.bondedRate,
          totalValidator: dashboardData?.totalValidator,
          apy: dashboardData.apy,
          marketCap: marketCap,
        },
      };
    } catch (err) {
      logger.error("dashboard-Error", err);
      return { error: true, message: RES_MSG.ERROR };
    }
  }
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
      let tokenPrice = await RedisService.getString(REDIS_KEY.TOKEN_PRICE);

      tokenPrice = tokenPrice === null ? 0 : tokenPrice;

      let marketCap = await RedisService.getString(REDIS_KEY.MARKET_CAP);
      marketCap = marketCap === null ? 0 : marketCap;

      let circulation_supply = await RedisService.getString(
        REDIS_KEY.CIRCULATING_SUPPLY
      );
      let validatorData = await RedisService.getString(REDIS_KEY.INFLATION_APY);
      validatorData = validatorData === null ? {} : JSON.parse(validatorData);

      // Extract necessary values from the validatorData object
      const { apy, totalSupply, inflation, totalValidator } = validatorData;
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
      } else if (payload.startsWith("qubetics") && payload.length === 47) {
        /* here we search for all transaction specfic to a wallet address*/
        txData = await transactionService.getTransactionsByAddress({
          address: payload,
          limit: 10,
          page: 0,
        });

        return txData;
      } else if (payload.startsWith("qubetics") && payload.length === 64) {
        /* here we search for all transaction specfic to a wallet address*/
        txData = await contractService.getContractByAddress(payload);

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
            new Date(startDate)
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
            currentDate
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
          new Date(currentDate)
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
          currentDate
        );
      }

      const totalAccount = await RedisService.getString(
        REDIS_KEY.TOTAL_ACCOUNTS
      );

      return {
        error: false,
        message: RES_MSG.ACCOUNT_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: await prisma.users.count(),
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
            new Date(startDate)
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
            currentDate
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
          new Date(currentDateModi)
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
          currentDate
        );
      }

      const totalContractDeployedTx = await RedisService.getString(
        REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX
      );

      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: await prisma.contracts.count(),
        },
      };
    } catch (err) {
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getAddressDetail(address: string): Promise<IESResponse> {
    try {
      console.log("address: ", address);

      const [user] = await Promise.all([
        prisma.users.findFirst({
          where: {
            address: address,
          },
          select: {
            txn: true,
          },
        }),
      ]);

      let txnCount = user ? user.txn : "";

      // Check if USER_BALANCE is in Redis
      let userBalance = await RedisService.getString(REDIS_KEY.USER_BALANCE);
      try {
        const response = await fetchRequest(
          `${environment.evmHost}/cosmos/bank/v1beta1/spendable_balances/${address}`,
          FETCH_METHODS.GET,
          HEADERS.DEFAULT
        );

        // Find the entry with denom "qubetics"
        const qubeticsAmount = response.data?.balances.find(
          (item: any) => item.denom === "qubetics"
        );

        userBalance = qubeticsAmount.amount;

        // Store userBalance in Redis
        await RedisService.setString(REDIS_KEY.USER_BALANCE, userBalance);
      } catch (error) {
        userBalance = "";
      }
      const actualBalance = userBalance
        ? (Number(userBalance) / Math.pow(10, 18)).toString()
        : "";

      let marketCapPrice = await RedisService.getString(
        CONST_NAME.MARKET_CAP_PRICE
      );

      let value: string;
      if (!marketCapPrice) {
        const latestEntry = await prisma.coinmarketInfo.findFirst({
          orderBy: {
            id: "desc",
          },
          select: {
            price: true,
          },
        });

        console.log("latestEntry?.price: ", latestEntry?.price);

        const price = latestEntry?.price?.toString() ?? "";
        value = price ? (Number(price) * Number(actualBalance)).toString() : "";
      } else {
        marketCapPrice = JSON.parse(marketCapPrice);

        value =
          marketCapPrice?.price && actualBalance
            ? (Number(marketCapPrice?.price) * Number(actualBalance)).toString()
            : "";
      }

      console.log("coinBalance ", {
        coinBalance: actualBalance,
        value: value,
        transactionCount: Number(txnCount),
      });

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
      console.log("error : ", err);

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
      console.log(payloads.time);
      console.log(payloads.interval);
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
            new Date(startDate)
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
            currentDate
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
          currentDate
        );
      }
      const totalTx = await RedisService.getString(REDIS_KEY.TOTAL_TX);
      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData: finalData as Array<GraphData>,
          count: await prisma.transactions.count(),
        },
      };
    } catch (err) {
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  // Function to check for invalid values
  public async hasInvalidValues(obj: any) {
    try {
      if (!obj) {
        return false;
      }
      return Object.values(obj).some(
        (value) =>
          value === false ||
          value === undefined ||
          value === null ||
          Number.isNaN(value)
      );
    } catch (error) {
      return false;
    }
  }
}

export default new ExplorerService();
