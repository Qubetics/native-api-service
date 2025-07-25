/* eslint-disable */

import axios, { Method } from "axios";
import logger from "../lib/logger";
import { DVPN_TYPE } from "../constant";

const fetchRequest = async (
  url: string,
  data: object,
  method: Method,
  headers: object,
) =>
  new Promise((resolve, reject) => {
    try {
      resolve(
        axios({
          method,
          url,
          data,
          headers,
        }),
      );
    } catch (err) {
      logger.error(`\x1b[31mError in http request helper: ${err}\x1b[31m`);
      reject(err);
    }
  });

export function convertBigIntToNumber(dataVal: any) {
  const finalDataVal = [];

  if (dataVal && typeof dataVal === "object") {
    for (const dataObject of dataVal) {
      for (const key in dataObject) {
        if (Object.prototype.hasOwnProperty.call(dataObject, key)) {
          const value = dataObject[key];

          if (typeof value === "bigint") {
            dataObject[key] = Number(value);
          }
        }
      }
      finalDataVal.push(dataObject);
    }
  }
  return finalDataVal;
}
export { fetchRequest };

export const getOffset = (page = 1, limit = 10) => {
  if (page < 1) page = 1;
  return (page - 1) * limit;
};

export const extractIP = (url: string): string => {
  try {
    let remoteUrl = url;
    const withoutProtocol = remoteUrl.replace(/^https?:\/\//, "");
    const hostname = withoutProtocol.split(":")[0];
    return hostname;
  } catch (err) {
    console.error("inavalidurl:", url);
    return "";
  }
};

export const getActiveItems = (data: any) => {
  const grouped: Record<
    string,
    {
      hasStart: boolean;
      hasCancel: boolean;
      startEntry: any;
      type: "subscription" | "session";
    }
  > = {};

  for (const entry of data) {
    let key = "";
    let startType = "";
    let cancelType = "";
    let itemType: "subscription" | "session";

    if (
      entry.type === DVPN_TYPE.START_SUBSCRIPTION ||
      entry.type === DVPN_TYPE.END_SUBSCRIPTION
    ) {
      if (!entry.subscriptionId) continue;
      key = `sub-${entry.subscriptionId}-${entry.accAddress}`;
      startType = DVPN_TYPE.START_SUBSCRIPTION;
      cancelType = DVPN_TYPE.END_SUBSCRIPTION;
      itemType = "subscription";
    } else if (
      entry.type === DVPN_TYPE.START_SESSION ||
      entry.type === DVPN_TYPE.END_SESSION
    ) {
      if (!entry.sessionId) continue;
      key = `sess-${entry.sessionId}-${entry.accAddress}`;
      startType = DVPN_TYPE.START_SESSION;
      cancelType = DVPN_TYPE.END_SESSION;
      itemType = "session";
    } else {
      continue;
    }

    if (!grouped[key]) {
      grouped[key] = {
        hasStart: false,
        hasCancel: false,
        startEntry: null,
        type: itemType,
      };
    }

    if (entry.type === startType) {
      grouped[key].hasStart = true;
      grouped[key].startEntry = entry;
    }

    if (entry.type === cancelType) {
      grouped[key].hasCancel = true;
    }
  }

  const activeSubscriptions = Object.values(grouped)
    .filter(
      (group) =>
        group.type === "subscription" && group.hasStart && !group.hasCancel,
    )
    .map((group) => group.startEntry!);

  const activeSessions = Object.values(grouped)
    .filter(
      (group) => group.type === "session" && group.hasStart && !group.hasCancel,
    )
    .map((group) => group.startEntry!);

  return {
    subscriptions: activeSubscriptions,
    sessions: activeSessions,
  };
};

export const lastDayTransactions = (data: any[]) => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return data.filter((txn) => {
    const createdAt = new Date(txn.createdAt);
    return createdAt >= twentyFourHoursAgo;
  });
};

export const calculateEarnings = (data: any[]) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let total_earning = 0;
  let daily_earnings = 0;

  data.forEach((item) => {
    // Only count START_SUBSCRIPTION transactions
    if (item.type === DVPN_TYPE.START_SUBSCRIPTION) {
      const amount = Number(item.price || 0);

      total_earning += amount;

      // Check if createdAt is within last 24 hours
      if (new Date(item.createdAt) >= dayAgo) {
        daily_earnings += amount;
      }
    }
  });

  return { total_earning, daily_earnings };
};
