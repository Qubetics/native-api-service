import prisma from "../../lib/db";
import { DVPN_TYPE, RES_MSG } from "../../constant/index";
import { IESResponse } from "../../interfaces/index";
import {
  convertBigIntToNumber,
  getDateRange,
  getOffset,
} from "../../helper/common.helper";
import { fetchRequest } from "../../Utility/common";

class DvpnService {
  async getAccountSummary(): Promise<IESResponse> {
    try {
      const result = await prisma.dvpnTransaction.findMany({
        where: {
          type: DVPN_TYPE.START_SESSION,
        },
        orderBy: { createdAt: "desc" },
      });
      const { startDate, endDate } = await getDateRange("monthly");

      const filteredMonthlyData = result.filter((item) => {
        const date = new Date(item.createdAt);
        return date >= startDate && date <= endDate;
      });

      // For weekly data
      const { startDate: weekStart, endDate: weekEnd } =
        await getDateRange("weekly");

      const filteredWeeklyData = result.filter((item) => {
        const date = new Date(item.createdAt);
        return date >= weekStart && date <= weekEnd;
      });

      // For daily data
      const { startDate: dayStart, endDate: dayEnd } =
        await getDateRange("daily");

      const filteredDailyData = result.filter((item) => {
        const date = new Date(item.createdAt);
        return date >= dayStart && date <= dayEnd;
      });

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          filteredDailyData:
            convertBigIntToNumber(filteredDailyData)?.length || 0,
          filteredWeeklyData:
            convertBigIntToNumber(filteredWeeklyData)?.length || 0,
          filteredMonthlyData:
            convertBigIntToNumber(filteredMonthlyData)?.length || 0,

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

  async getAccountList(data: {
    page: number;
    limit: number;
    orderBy: any;
  }): Promise<IESResponse> {
    try {
      const result = await prisma.dvpnTransaction.findMany({
        where: {
          type: DVPN_TYPE.START_SUBSCRIPTION,
        },
        orderBy: { createdAt: data?.orderBy },
        skip: data.page * data.limit,
        take: data.limit,
      });

      const total_count = await prisma.dvpnTransaction.count({
        where: {
          type: DVPN_TYPE.START_SUBSCRIPTION,
        },
      });

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
      const url = `${environment.nodeInfoUrl}/qubetics/session/v3/sessions?pagination.offset=${offset}&pagination.limit=${data.limit}&pagination.reverse=${data.reverse}`;
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
}

export default new DvpnService();
