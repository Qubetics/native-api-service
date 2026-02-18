import prisma from "../../lib/db";
import { DVPN_TYPE, MSG_START_SUBSCRIPTION, RES_MSG } from "../../constant/index";
import { IESResponse } from "../../interfaces/index";
import {
  convertBigIntToNumber,
  getActiveItems,
  getDateRange,
  getOffset,
} from "../../helper/common.helper";
import { fetchRequest, formatNodes } from "../../Utility/common";

class DvpnService {
  async getAccountSummary(): Promise<IESResponse> {
    try {
      const types = [DVPN_TYPE.START_SESSION, DVPN_TYPE.START_SUBSCRIPTION];
  
      // 1. Get Date Ranges (ensure your getDateRange returns the 7-day rolling window we discussed)
      const { startDate: dayStart, endDate: dayEnd } = await getDateRange("daily");
      const { startDate: weekStart, endDate: weekEnd } = await getDateRange("weekly");
      const { startDate: monStart, endDate: monEnd } = await getDateRange("monthly");
  
      /**
       * Helper to fetch unique users via groupBy.
       * We don't need 'orderBy' here because we just need the count of unique groups.
       */
      const getUniqueUserCount = async (start: Date, end: Date) => {
        const result = await prisma.dvpnTransaction.groupBy({
          by: ['accAddress'],
          where: {
            type: { in: types },
            accAddress: { not: null },
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        });
        return result.length; // Each item in the array is one unique accAddress
      };
  
      // 2. Execute counts in parallel for performance
      const [dailyCount, weeklyCount, monthlyCount] = await Promise.all([
        getUniqueUserCount(dayStart, dayEnd),
        getUniqueUserCount(weekStart, weekEnd),
        getUniqueUserCount(monStart, monEnd),
      ]);
  
      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          filteredDailyData: dailyCount,   // Unique users last 24h
          filteredWeeklyData: weeklyCount, // Unique users last 7 days
          filteredMonthlyData: monthlyCount, // Unique users last 30 days
          native: true,
        },
      };
    } catch (err) {
      console.error("Account Summary Error:", err);
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getAccountList(data: {
    page: number;
    limit: number;
    orderBy: any;
  }): Promise<IESResponse> {
    try {
      const [result, total_count] = await Promise.all([
        prisma.dvpnTransaction.findMany({
          where: {
            type: DVPN_TYPE.START_SUBSCRIPTION,
          },
          orderBy: { createdAt: data?.orderBy },
          skip: data.page * data.limit,
          take: data.limit,
        }),
        prisma.dvpnTransaction.count({
          where: {
            type: DVPN_TYPE.START_SUBSCRIPTION,
          },
        }),
      ]);

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          result: convertBigIntToNumber(result),
          total_count,
          native: true,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getActiveAccounts(data: {
    page: number;
    limit: number;
    reverse: boolean;
  }): Promise<IESResponse> {
    try {
      const offset = getOffset(data.page, data.limit);
      const url = `${environment.nodeInfoUrl}/qubetics/session/v3/sessions?pagination.offset=${offset}&pagination.limit=${data.limit}&pagination.reverse=${data.reverse}&pagination.count_total=true`;

      const fetchRes: any = await fetchRequest(url, "GET", null);
      if (fetchRes?.error || !fetchRes?.data) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          ...fetchRes?.data,
          native: true,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getNetworkAnalytics(): Promise<IESResponse> {
    try {
      const [totalUser, transactions, fetchRes] = await Promise.all([
        prisma.dvpnTransaction.count({
          where: { type: DVPN_TYPE.START_SUBSCRIPTION },
        }),
        prisma.dvpnTransaction.findMany(),
        fetchRequest(
          `${environment.nodeInfoUrl}/qubetics/node/v3/nodes`,
          "GET",
          null,
        ),
      ]);

      const activeUsers = getActiveItems(transactions);

      const formattedNodes = formatNodes(fetchRes.data.nodes);

      const totalCountries = new Set(
        formattedNodes.map((node: any) => node.country),
      ).size;

      const activeNodes = fetchRes.data.nodes.filter(
        (node: any) => node.status === "active",
      ).length;

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          total_user: totalUser,
          total_country: totalCountries,
          active_nodes: activeNodes,
          active_session: activeUsers?.sessions.length,
          native: true,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getAddressDetails(address: any): Promise<IESResponse> {
    try {
      const totalEarning: any = await prisma.$queryRaw`
      SELECT CAST(SUM(CAST(NULLIF(price, '') AS DECIMAL)) AS VARCHAR) as total
      FROM "DvpnTransaction"
      WHERE "provAddress" = ${address || ""} AND "type" = ${MSG_START_SUBSCRIPTION}
    `;

      const dailyEarning: any = await prisma.$queryRaw`
      SELECT CAST(SUM(CAST(NULLIF(price, '') AS DECIMAL)) AS VARCHAR) as total
      FROM "DvpnTransaction"
      WHERE "provAddress" = ${address || ""} AND "type" = ${MSG_START_SUBSCRIPTION}
      AND DATE("createdAt") = CURRENT_DATE
    `;

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          totalEarning: totalEarning[0]?.total || "0",
          dailyEarning: dailyEarning[0]?.total || "0",
          native: true,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getNodeDetails(address: any): Promise<IESResponse> {
    try {
      const totalNodeEarning: any = await prisma.$queryRaw`
      SELECT
        COALESCE(
          CAST(
            SUM(
              CASE 
                WHEN "price" ~ '^[0-9]+(\.[0-9]+)?$' 
                THEN CAST("price" AS DECIMAL)
                ELSE 0
              END
            ) AS VARCHAR
          ),
          '0'
        ) AS total
      FROM "DvpnTransaction"
      WHERE type = 'NODE_EARNING'
        AND "nodeAddress" = ${address}
    `;

      const dailyNodeEarning: any = await prisma.$queryRaw`
      SELECT
        COALESCE(
          CAST(
            SUM(
              CASE 
                WHEN "price" ~ '^[0-9]+(\.[0-9]+)?$' 
                THEN CAST("price" AS DECIMAL)
                ELSE 0
              END
            ) AS VARCHAR
          ),
          '0'
        ) AS total
      FROM "DvpnTransaction"
      WHERE type = 'NODE_EARNING'
        AND "nodeAddress" = ${address}
        AND DATE("createdAt") = CURRENT_DATE
    `;
    

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          totalEarning: totalNodeEarning[0]?.total || "0",
          dailyEarning: dailyNodeEarning[0]?.total || "0",
          native: true,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }
}

export default new DvpnService();
