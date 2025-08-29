import prisma from "../../lib/db";
import {
  subDays,
  startOfDay,
  eachDayOfInterval,
  startOfMonth,
  eachMonthOfInterval,
  subMonths,
} from "date-fns";
import {
  sessionsPath,
  daysMap,
  MSG_TYPE,
  subscriptionPath,
  RES_MSG,
  MSG_START_SESSION,
  MSG_CANCEL_SESSION,
  MSG_START_SUBSCRIPTION,
  MSG_CANCEL_SUBSCRIPTION,
} from "../../constant";
import { convertBigIntToNumber } from "../../helper/common.helper";

class MessageService {
  /**
   * Get all message data entries based on type filter
   * @param data
   * @returns
   */
  async getAllMessage(data: { txHash: string }): Promise<any> {
    try {
      const sessions = await prisma.dvpnTransaction.findMany({
        where: {
          txhash: data.txHash,
        },
      });

      if (!sessions || sessions?.length === 0) {
        return {
          error: true,
          message: RES_MSG.NOT_FOUND,
          data: [],
        };
      }

      const session = sessions[0];
      const { type, sessionId, subscriptionId } = session;

      switch (type) {
        case MSG_START_SESSION:
          return {
            error: false,
            message: RES_MSG.FETCH_SUCCESS,
            data: { sessionEntries: convertBigIntToNumber([session]) },
          };

        case MSG_CANCEL_SESSION:
          if (sessionId) {
            const relatedSessions = await prisma.dvpnTransaction.findMany({
              where: {
                sessionId,
                type: {
                  in: sessionsPath,
                },
              },
              orderBy: { createdAt: "desc" },
            });

            return {
              error: false,
              message: RES_MSG.FETCH_SUCCESS,
              data: { sessionEntries: convertBigIntToNumber(relatedSessions) },
            };
          }
          break;

        case MSG_START_SUBSCRIPTION:
          return {
            error: false,
            message: RES_MSG.FETCH_SUCCESS,
            data: { sessionEntries: convertBigIntToNumber([session]) },
          };

        case MSG_CANCEL_SUBSCRIPTION:
          if (subscriptionId) {
            const relatedSubscriptions = await prisma.dvpnTransaction.findMany({
              where: {
                subscriptionId,
                type: {
                  in: subscriptionPath,
                },
              },
              orderBy: { createdAt: "desc" },
            });

            return {
              error: false,
              message: RES_MSG.FETCH_SUCCESS,
              data: {
                sessionEntries: convertBigIntToNumber(relatedSubscriptions),
              },
            };
          }
          break;

        default:
          return {
            error: false,
            message: RES_MSG.INVALID_MESSAGE,
            data: { sessionEntries: convertBigIntToNumber([session]) },
          };
      }

      return {
        error: false,
        message: RES_MSG.INVALID_MESSAGE,
        data: { sessionEntries: [session] },
      };
    } catch (error) {
      console.error("Error while fetching message:", error);
      return {
        error: true,
        message:
          error instanceof Error
            ? error.message.includes("prisma")
              ? "Server Error"
              : error.message
            : "Unknown error",
      };
    }
  }

  async getUpTimeHistory(data: {
    nodeAddress: string;
    duration: string;
  }): Promise<any> {
    try {
      const daysAgo = daysMap[data.duration] || 7;
      const currentDate = startOfDay(new Date());
      const fromDate = startOfDay(subDays(currentDate, daysAgo - 1));

      // Fetch transactions
      const transactions = await prisma.transactions.findMany({
        where: {
          type: { in: MSG_TYPE },
          createdAt: { gte: fromDate },
          nodeAddress: data?.nodeAddress,
        },
        select: { value: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      // Decide whether to bucket by day or month
      const isYearly = daysAgo === 365;
      const bucketFn = isYearly ? startOfMonth : startOfDay;

      // Group transactions into buckets
      const grouped: Record<string, number> = {};
      for (const tx of transactions) {
        const key = bucketFn(tx.createdAt).toISOString();
        const val = tx.value ? parseFloat(tx.value) : 0;
        grouped[key] = (grouped[key] || 0) + val;
      }

      // Build full interval (days or months)
      const alignedFrom = isYearly
        ? startOfMonth(subMonths(currentDate, 11))
        : fromDate;
      const alignedCurrent = isYearly ? startOfMonth(currentDate) : currentDate;
      const intervals = isYearly
        ? eachMonthOfInterval({ start: alignedFrom, end: alignedCurrent }).map(
            (d) => startOfMonth(d),
          )
        : eachDayOfInterval({ start: alignedFrom, end: alignedCurrent });

      // Format response
      let formatted = intervals.map((date) => {
        const key = bucketFn(date).toISOString();
        return {
          createdAt: key,
          count: grouped[key] ? parseFloat(grouped[key].toFixed(2)) : 0,
        };
      });

      // Add total only for yearly
      if (isYearly) {
        formatted = formatted.slice(-12);
        const totalCount = formatted.reduce((sum, item) => sum + item.count, 0);
        return {
          error: false,
          message: "transaction history fetched successfully",
          data: formatted,
        };
      }

      return {
        error: false,
        message: "Fetched uptime history successfully",
        data: formatted,
      };
    } catch (error) {
      console.error("Error while fetching uptime history:", error);
      return {
        error: true,
        message:
          error instanceof Error
            ? error.message.includes("prisma")
              ? "Server Error"
              : error.message
            : "Unknown error",
      };
    }
  }
}

export default new MessageService();
