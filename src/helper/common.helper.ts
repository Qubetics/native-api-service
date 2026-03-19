/* eslint-disable */

import axios, { Method } from "axios";
import logger from "../lib/logger";

import type { SupplyResult, Breakdown } from "../interfaces/index";
import { ALLOCATIONS, TOTAL_SUPPLY } from "../constant/index";
import { getCurrentDateTime, roundToDecimals } from "../lib/utilities.helper";
import { getUnlocked } from "./calculateAPR.helper";
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

function convertBigIntToNumber(dataVal: any) {
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

function calculateSupplyDetails(): SupplyResult {
  const currentDate = getCurrentDateTime();

  const breakdown: Breakdown = {};
  let totalUnlocked = 0;

  // Calculate unlocked amount for each allocation
  for (const [name, alloc] of Object.entries(ALLOCATIONS)) {
    const unlocked = getUnlocked(name, alloc, currentDate);

    breakdown[name] = {
      unlocked: roundToDecimals(unlocked, 2),
      total: alloc.total,
      percentage:
        alloc.total > 0
          ? roundToDecimals((unlocked / alloc.total) * 100, 4)
          : 0,
    };

    totalUnlocked += unlocked;
  }

  return {
    timestamp: currentDate.toISOString(),
    circulating_supply: roundToDecimals(totalUnlocked, 2),
    total_supply: TOTAL_SUPPLY,
    max_supply: TOTAL_SUPPLY,
    circulating_percentage: roundToDecimals(
      (totalUnlocked / TOTAL_SUPPLY) * 100,
      4,
    ),
    locked_supply: roundToDecimals(TOTAL_SUPPLY - totalUnlocked, 2),
    breakdown,
  };
}

export { fetchRequest, convertBigIntToNumber, calculateSupplyDetails };

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

export const extractBothIP = (remoteUrl: string): string | null => {
  try {
    if (!remoteUrl) return null;
    // Remove scheme if present
    let url = remoteUrl.replace(/^https?:\/\//, '');
    // Handle IPv6 with port
    if (url.includes(']')) {
      // [IPv6]:port
      url = url.substring(0, url.indexOf(']') + 1);
    } else if (url.includes(':')) {
      // raw IPv6 or IPv4 with port
      url = url.substring(0, url.lastIndexOf(':'));
    }
    // Remove surrounding brackets for IPv6
    url = url.replace(/^\[|\]$/g, '');
    return url;
  } catch (err) {
    console.error("extractBothIP error:", err);
    return null;
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
  const now = new Date();

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
      key = `sub-${entry.subscriptionId}-${entry.nodeAddress}`;
      startType = DVPN_TYPE.START_SUBSCRIPTION;
      cancelType = DVPN_TYPE.END_SUBSCRIPTION;
      itemType = "subscription";
    } else if (
      entry.type === DVPN_TYPE.START_SESSION ||
      entry.type === DVPN_TYPE.END_SESSION
    ) {
      if (!entry.sessionId) continue;
      key = `sess-${entry.sessionId}-${entry.nodeAddress}`;
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
    .filter((group) => {
      if (group.type !== "subscription" || !group.hasStart || group.hasCancel) {
        return false;
      }

      if (group.startEntry?.inactiveAt) {
        const inactiveAt = new Date(group.startEntry.inactiveAt);
        if (inactiveAt <= now) {
          return false;
        }
      }

      return true;
    })
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

export const getDateRange = (type: any) => {
  const today = new Date(); // Always use current date and time
  let startDate, endDate;

  switch (type.toLowerCase()) {
    case "daily":
      // Start and end of the same day
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "weekly":
      // 'today.getDate() - 7' gets the same day last week
      // e.g., If today is Monday the 16th, startDate becomes Monday the 9th
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      // End at the final millisecond of the current day
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // Start from 1st of current month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      // End at current date
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      break;

    default:
      throw new Error('Invalid type. Use "daily", "weekly", or "monthly"');
  }

  return { startDate, endDate };
};
