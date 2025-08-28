import countries from "i18n-iso-countries";
import geoip from "geoip-lite";
import prisma from "../../lib/db";
import { DVPN_TYPE, RES_MSG } from "../../constant/index";
import { HolderData, IESResponse } from "../../interfaces/index";
import {
  convertBigIntToNumber,
  extractIP,
  getActiveItems,
  lastDayTransactions,
  getOffset,
  calculateEarnings,
} from "../../helper/common.helper";
import { fetchRequest, noExponent } from "../../Utility/common";
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

const formatNodes = (nodes: any[]) => {
  return nodes
    .map((node: any) => {
      const ip = extractIP(node.remote_url);
      if (ip) {
        const geo: any = geoip.lookup(ip);
        const countryName = countries.getName(geo?.country, "en");
        const flagUrl = `https://flagcdn.com/w80/${geo?.country.toLowerCase()}.png`;
        return {
          address: node.address,
          gigabyte_prices: Array.isArray(node.gigabyte_prices)
            ? node.gigabyte_prices
            : [],
          hourly_prices: Array.isArray(node.hourly_prices)
            ? node.hourly_prices
            : [],
          remote_url: node.remote_url,
          inactive_at: node?.inactive_at ? new Date(node.inactive_at) : null,
          status: node.status,
          status_at: node?.status_at ? new Date(node.status_at) : null,
          country: countryName || "Unknown",
          city: geo?.city || "Unknown",
          long: geo?.ll[1].toString(),
          lat: geo?.ll[0].toString(),
          flag_url: flagUrl,
        };
      }
    })
    .filter(Boolean); // Remove undefined entries where IP extraction failed
};

class NodeService {
  /**
   * get all tokens
   * @param data
   * @returns
   */
  async getAllNodes(data: {
    page: number;
    limit: number;
    reverse: boolean;
  }): Promise<IESResponse> {
    try {
      const offset = getOffset(data.page, data.limit);
      const url = `${environment.nodeInfoUrl}/qubetics/node/v3/nodes?pagination.offset=${offset}&pagination.limit=${data.limit}&pagination.reverse=${data.reverse}&pagination.count_total=true`;
      const fetchRes = await fetchRequest(url, "GET", null);

      if (fetchRes?.error || !fetchRes?.data) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      const {
        data: { nodes, pagination },
        error,
      } = fetchRes;

      const formattedNodes = formatNodes(nodes);

      return {
        error,
        message: RES_MSG.SUCCESS,
        data: {
          nodes: formattedNodes,
          total: pagination.total,
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

  async getNodeDetails(
    address: string | null,
    page: number,
    limit: number,
  ): Promise<IESResponse> {
    try {
      if (!address) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      const [result, total_count] = await Promise.all([
        prisma.transactions.findMany({
          where: {
            nodeAddress: address || "",
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: page * limit,
          take: limit,
        }),
        prisma.transactions.count({
          where: {
            nodeAddress: address || "",
          },
        }),
      ]);

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          result: convertBigIntToNumber(result),
          total_count: total_count ?? 0,
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

  async getNodesPerformance(): Promise<IESResponse> {
    try {
      const url = `${environment.nodeInfoUrl}/qubetics/provider/v2/providers`;
      const [fetchRes, transactions, total_users] = await Promise.all([
        fetchRequest(url, "GET", null),
        prisma.dvpnTransaction.findMany(),
        prisma.dvpnTransaction.count({
          where: { type: DVPN_TYPE.START_SUBSCRIPTION },
        }),
      ]);

      const activeCount =
        fetchRes?.data?.providers?.filter((p: any) => p.status === "active")
          ?.length || 0;
      const active_users = getActiveItems(transactions);

      const lastDayTxns = lastDayTransactions(transactions); // your array

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          // result:convertBigIntToNumber(result),
          lastDayTransactions: lastDayTxns?.length ?? 0,
          active_users: active_users?.subscriptions?.length ?? 0,
          active_session: active_users?.sessions.length ?? 0,
          total_txns: transactions?.length ?? 0,
          total_users,
          active_providers: activeCount,
          total_providers: Number(fetchRes?.data?.pagination?.total ?? 0),
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

  async getNodesSummary(): Promise<IESResponse> {
    try {
      const url = `${environment.nodeInfoUrl}/qubetics/node/v3/nodes`;
      const fetchRes = await fetchRequest(url, "GET", null);

      if (fetchRes?.error || !fetchRes?.data) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      const seenCountries = new Set();
      const formattedNodes = formatNodes(fetchRes?.data?.nodes);
      const uniqueCountries = formattedNodes
        .filter(({ country }: any) => {
          if (seenCountries.has(country)) return false;
          seenCountries.add(country);
          return true;
        })
        .map(({ country, long, lat }: any) => ({ country, long, lat }));

      const result = await prisma.dvpnTransaction.findMany();
      const lastDayTxns = lastDayTransactions(result); // your array

      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          nodesLocation: uniqueCountries,
          lastDayTransactions: lastDayTxns?.length ?? 0,
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

  async getNodeDetailSummary(address: string | null): Promise<IESResponse> {
    try {
      if (!address) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      const result = await prisma.dvpnTransaction.findMany({
        where: {
          nodeAddress: address || "",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const total_users =
        result?.filter((val: any) => val.type === DVPN_TYPE.START_SESSION)
          ?.length || 0;

      const activeItems = getActiveItems(result);
      const last_checked = result[0]?.createdAt;
      const reponse = calculateEarnings(result);
      return {
        error: false,
        message: RES_MSG.SUCCESS,
        data: {
          total_earning: noExponent(reponse.total_earning),
          daily_earnings: noExponent(reponse?.daily_earnings),
          total_users,
          active_users: activeItems?.sessions?.length ?? 0,
          last_checked,
          recent_session: activeItems?.sessions[0]?.startAt ?? null,
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

export default new NodeService();
