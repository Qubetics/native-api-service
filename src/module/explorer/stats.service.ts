import { RedisService } from "../../service";
import {
  REDIS_KEY,
  RES_MSG,
  CURRENT_DEFAULT_APR,
  CURRENT_DEFAULT_COIN_PRICE,
} from "../../constant";
import { IESResponse, IGraphResponse, GraphData } from "../../interfaces";
import { calculateData } from "../../helper/validatorMetrics.helper";
import prisma from "../../lib/db";
import logger from "../../lib/logger";
import {
  fillMissingDatesWithZeroByhr,
  fillMissingDatesWithZeroByDay,
  fillMissingMinutes,
  fillMissingDatesWithZeroByMonth,
} from "../../lib/utilities.helper";
import supplyService from "./supply.service";
import { calculateSupplyDetails } from "../../helper/common.helper";

class StatsService {
  async dashboard(): Promise<IESResponse> {
    try {
      const [
        data,
        latestBlock,
        transactionCount,
        marketCap,
        tokenPrice,
        userCount,
        burnedAmount,
        totalSupply,
      ] = await Promise.all([
        calculateData() as Promise<any>,
        RedisService.getString(REDIS_KEY.LATEST_BLOCK),
        RedisService.getString(REDIS_KEY.NATIVE_TRANSACTIONS_COUNT),
        RedisService.getString(REDIS_KEY.MARKET_CAP),
        RedisService.getString(REDIS_KEY.COIN_PRICE).then(
          (val) => val ?? CURRENT_DEFAULT_COIN_PRICE,
        ),
        prisma.users.count(),
        RedisService.getString(REDIS_KEY.TOTAL_BURNED_AMOUNT),
        RedisService.getString(REDIS_KEY.TOTAL_SUPPLY),
      ]);

      
      const circulationSupply = await calculateSupplyDetails();

      const finalMarketCap =
        marketCap === "0" || !marketCap
          ? (Number(tokenPrice) * Number(circulationSupply)).toString()
          : marketCap;

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          apy: CURRENT_DEFAULT_APR,
          inflation: data.inflation,
          totalSupply: totalSupply || data.totalSupply,
          totalValidator: data.totalValidator,
          circulation_supply: circulationSupply,
          apr: data?.apr ? Number(data?.apr) : CURRENT_DEFAULT_APR,
          tokenPrice: tokenPrice,
          validators: data?.validator ?? 0,
          circulationSupply: circulationSupply,
          latest_block: latestBlock,
          total_transactions: transactionCount,
          total_accounts: userCount,
          bondedTokens: data?.bondedTokens ? Number(data.bondedTokens) : 0,
          bondedRate: data?.bondedRate,
          marketCap: finalMarketCap,
          community_pool: data?.community_pool ?? 0,
          burnedAmount: burnedAmount || 0,
        },
      };
    } catch (err) {
      logger.error("Error in dashboard data:", err);
      return { error: true, message: RES_MSG.NOT_FOUND };
    }
  }

  async getAccountCounts(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData: any[] = [];
      let finalData: GraphData[] = [];
      let startDate = new Date();
      const currentDate = new Date();

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          startDate.setDate(startDate.getDate() - 1);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
            FROM "Users"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            GROUP BY "hour" ORDER BY "hour";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByhr(graphData, startDate)
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        } else {
          startDate.setDate(startDate.getDate() - payloads.interval);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
            FROM "Users"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            GROUP BY "day" ORDER BY "day";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByDay(
              graphData,
              startDate,
              currentDate,
            )
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        }
      } else if (payloads.time === "h") {
        startDate.setHours(startDate.getHours() - payloads.interval);
        graphData = (await prisma.$queryRaw`
          SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
          FROM "Users"
          WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
          GROUP BY "hour" ORDER BY "hour";
        `) as any[];
        finalData = (
          await fillMissingMinutes(graphData, startDate, currentDate)
        ).map((d) => ({
          createdAt: d.createdAt,
          count: Number(d.count || 0),
        }));
      } else if (payloads.time === "y" && payloads.interval === 1) {
        startDate.setFullYear(startDate.getFullYear() - 1);
        graphData = (await prisma.$queryRaw`
          SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
          FROM "Users"
          WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
          GROUP BY "month" ORDER BY "month";
        `) as any[];
        finalData = (
          await fillMissingDatesWithZeroByMonth(
            graphData,
            startDate,
            currentDate,
          )
        ).map((d) => ({
          createdAt: d.createdAt,
          count: Number(d.count || 0),
        }));
      }

      return {
        error: false,
        message: RES_MSG.ACCOUNT_HISTORY_SUCCESS,
        data: {
          finalData,
          count: await prisma.users.count(),
        },
      };
    } catch (err) {
      logger.error("Error in getAccountCounts:", err);
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getContractDeployedCount(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData: any[] = [];
      let finalData: GraphData[] = [];
      let startDate = new Date();
      const currentDate = new Date();

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          startDate.setDate(startDate.getDate() - 1);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
            FROM "Transactions"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            AND "type" = 'CONTRACT_CREATION'
            GROUP BY "hour" ORDER BY "hour";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByhr(graphData, startDate)
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        } else {
          startDate.setDate(startDate.getDate() - payloads.interval);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
            FROM "Transactions"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            AND "type" = 'CONTRACT_CREATION'
            GROUP BY "day" ORDER BY "day";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByDay(
              graphData,
              startDate,
              currentDate,
            )
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        }
      } else if (payloads.time === "h") {
        startDate.setHours(startDate.getHours() - payloads.interval);
        graphData = (await prisma.$queryRaw`
          SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
          FROM "Transactions"
          WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
          AND "type" = 'CONTRACT_CREATION'
          GROUP BY "hour" ORDER BY "hour";
        `) as any[];
        finalData = (
          await fillMissingMinutes(graphData, startDate, currentDate)
        ).map((d) => ({
          createdAt: d.createdAt,
          count: Number(d.count || 0),
        }));
      } else if (payloads.time === "y" && payloads.interval === 1) {
        startDate.setFullYear(startDate.getFullYear() - 1);
        graphData = (await prisma.$queryRaw`
          SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
          FROM "Transactions"
          WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
          AND "type" = 'CONTRACT_CREATION'
          GROUP BY "month" ORDER BY "month";
        `) as any[];
        finalData = (
          await fillMissingDatesWithZeroByMonth(
            graphData,
            startDate,
            currentDate,
          )
        ).map((d) => ({
          createdAt: d.createdAt,
          count: Number(d.count || 0),
        }));
      }

      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData,
          count: await prisma.contracts.count(),
        },
      };
    } catch (err) {
      logger.error("Error in getContractDeployedCount:", err);
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async tpsHistory(payloads: {
    time: string;
    interval: number;
  }): Promise<IGraphResponse> {
    try {
      let graphData: any[] = [];
      let finalData: GraphData[] = [];
      let startDate = new Date();
      const currentDate = new Date();

      if (payloads.time === "d") {
        if (payloads.interval === 1) {
          startDate.setDate(startDate.getDate() - 1);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
            FROM "Transactions"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            GROUP BY "hour" ORDER BY "hour";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByhr(graphData, startDate)
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        } else {
          startDate.setDate(startDate.getDate() - payloads.interval);
          graphData = (await prisma.$queryRaw`
            SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
            FROM "Transactions"
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
            GROUP BY "day" ORDER BY "day";
          `) as any[];
          finalData = (
            await fillMissingDatesWithZeroByDay(
              graphData,
              startDate,
              currentDate,
            )
          ).map((d) => ({
            createdAt: d.createdAt,
            count: Number(d.count || 0),
          }));
        }
      } else if (payloads.time === "y" && payloads.interval === 1) {
        startDate.setFullYear(startDate.getFullYear() - 1);
        graphData = (await prisma.$queryRaw`
          SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
          FROM "Transactions"
          WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${currentDate}
          GROUP BY "month" ORDER BY "month";
        `) as any[];
        finalData = (
          await fillMissingDatesWithZeroByMonth(
            graphData,
            startDate,
            currentDate,
          )
        ).map((d) => ({
          createdAt: d.createdAt,
          count: Number(d.count || 0),
        }));
      }

      return {
        error: false,
        message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
        data: {
          finalData,
          count: await prisma.transactions.count(),
        },
      };
    } catch (err) {
      logger.error("Error in tpsHistory:", err);
      return { error: true, message: RES_MSG.ERROR };
    }
  }
}

export default new StatsService();
