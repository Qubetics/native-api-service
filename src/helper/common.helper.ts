/* eslint-disable */

import axios, { Method } from "axios";
import logger from "../lib/logger";

import type { SupplyResult, Breakdown } from '../interfaces/index';
import { ALLOCATIONS, TOTAL_SUPPLY } from '../constant/index';
import { getCurrentDateTime, roundToDecimals } from '../lib/utilities.helper';
import { getUnlocked } from './calculateAPR.helper';

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

export { fetchRequest,convertBigIntToNumber, calculateSupplyDetails  };
