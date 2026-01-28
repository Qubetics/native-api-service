import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  RES_MSG,
  CONST_NAME,
  REDIS_KEY,
  CURRENT_DEFAULT_APR,NETWORK_LAUNCH
} from "../constant";
import { Params, BlockHeader, Allocation } from "../interfaces/index";
import logger from "../lib/logger";
import { getDigitsAfterE, addMonths } from "../lib/utilities.helper";
import { RedisService } from "../service";

// async function getParams_old(apiRes: AxiosInstance): Promise<any | false> {
//   try {
//     const [
//       validatorResponse,
//       circulationSupplyResponse,
//       inflationRateResponse,
//       poolResponse,
//       paramsResponse,
//       totalSupplyResponse,
//     ] = await Promise.all([
//       apiRes.get("/cosmos/staking/v1beta1/validators"),
//       apiRes.get(
//         `/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.symbol}`
//       ),
//       apiRes.get("/cosmos/mint/v1beta1/inflation"),
//       apiRes.get("/cosmos/staking/v1beta1/pool"),
//       apiRes.get("/cosmos/distribution/v1beta1/params"),
//       apiRes.get("/cosmos/bank/v1beta1/supply"),
//     ]);

//     const validator = validatorResponse?.data?.validators.filter(
//       (item: any) => item.status === CONST_NAME.BOND_STATUS
//     );

//     if (validator?.length === 0) {
//       return false;
//     }

//     const circulation_supply: number =
//       Number(circulationSupplyResponse.data.amount.amount) / CONST_NAME.ETH_EXP;

//     const inflation: any = Number(inflationRateResponse.data.inflation);

//     // const formattedInflationRate = `${inflation_rate}`;

//     const annualProvisions = Number(circulation_supply * parseFloat(inflation));

//     let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
//     blocksPerYear = Number(blocksPerYear / 2);
//     // const inflation = formattedInflationRate;

//     const bondedTokens =
//       Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;

//     const totalSupply = totalSupplyResponse.data.supply[0].amount;

//     const bondedRate = Number(((bondedTokens / totalSupply) * 100).toFixed(3));

//     const communityTax = Number(paramsResponse.data.params.community_tax);

//     return {
//       annualProvisions,
//       blocksPerYear,
//       inflation,
//       bondedTokens,
//       communityTax,
//       validator: validator?.length,
//       circulation_supply,
//       bondedRate,
//       totalSupply,
//       totalValidators: validatorResponse?.data?.validators.length,
//     };
//   } catch (error) {
//     logger.log("error occurred while calculating stake APR", error);
//     return false;
//   }
// }

// Calculate Annual Percentage Yield (APY) based on parameters
function calculateAPY(
  inflation: number,
  bondedRate: number,
  communityTax: number,
): number {
  const apy = Number(
    ((inflation / bondedRate) * (1 - communityTax) * 100).toFixed(2),
  );
  return apy;
}

const calculateData = async (): Promise<
  | {
      apr: string;
      circulationSupply: number;
      validator: number;
      bondedTokens: number;
      bondedRate: number;
      totalValidator: number;
      community_pool: number;
    }
  | { error: boolean; message: string }
> => {
  try {
    const apiUrl = environment.evmHost;
    const apiRes = axios.create({
      baseURL: apiUrl,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      timeout: 5 * CONST_NAME.THOUSAND,
    });

    const params = await getParams(apiRes);
    let apr = CURRENT_DEFAULT_APR;
    if (!params) throw new Error(RES_MSG.FETCH_SUCCESS);
    try {
      const getApr = await apiRes.get("/qubetics/validatorpool/params");
      const annualRoi = getApr?.data?.params?.annual_roi;
      if (annualRoi != null) {
        apr = annualRoi / 100;
      }
    } catch (error) {
      console.log("Error while getng apr details", error);
    }

    const apyValue = calculateAPY(
      Number(params.inflation),
      Number(params.bondedRate),
      params.communityTax,
    );

    const validatorData = {
      totalSupply: params?.total_supply,
      inflation: Number(params?.inflation),
      apy: apyValue ?? CURRENT_DEFAULT_APR,
      totalValidator: params.totalValidators,
      circulation_supply: params.circulation_supply,
      apr: apr.toString(),
      circulationSupply: params?.circulation_supply,
      validator: params?.activeValidator,
      bondedTokens: params?.bondedTokens,
      bondedRate: params?.bondedRate,
      community_pool: params?.community_pool,
    };

    await RedisService.setString(
      REDIS_KEY.VALIDATOR_DATA,
      JSON.stringify(validatorData),
    );
    return validatorData;
  } catch (err) {
    console.log("error", "Error occurred while calculating stake APY", err);
    if (err instanceof Error) {
      return { error: true, message: err.message };
    }
    return { error: true, message: RES_MSG.NOT_FOUND };
  }
};

async function getParams(apiRes: AxiosInstance): Promise<Params | false> {
  try {
    const [
      validatorResponse,
      circulationSupplyResponse,
      inflationRateResponse,
      poolResponse,
      paramsResponse,
      total_Supply,
      annualProvision,
      community_pool,
    ] = await Promise.all([
      apiRes.get("/cosmos/staking/v1beta1/validators"),
      apiRes.get(
        `/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.symbol.toLowerCase()}`,
      ),
      apiRes.get("/cosmos/mint/v1beta1/inflation"),
      apiRes.get("/cosmos/staking/v1beta1/pool"),
      apiRes.get("/cosmos/distribution/v1beta1/params"),
      apiRes.get("/cosmos/bank/v1beta1/supply"),
      apiRes.get("/cosmos/mint/v1beta1/annual_provisions"),
      apiRes.get("/cosmos/distribution/v1beta1/community_pool"),
    ]);

    const activeValidator = validatorResponse?.data?.validators.filter(
      (item: any) => item.status === CONST_NAME.BOND_STATUS,
    );

    if (activeValidator?.length === 0) {
      return false;
    }
    const validator = validatorResponse?.data?.validators;

    const totalValidator: number | undefined =
      validatorResponse?.data?.validators?.length;
    if (totalValidator === undefined) {
      return false;
    }

    const circulation_supply: number =
      Number(circulationSupplyResponse.data.amount.amount) / CONST_NAME.ETH_EXP;

    const inflation_rate = Number(inflationRateResponse.data.inflation);

    const formattedInflationRate = `${inflation_rate}`;

    let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
    blocksPerYear = Number(blocksPerYear / 2);
    const inflation = formattedInflationRate;

    const bondedTokens =
      Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;
    // const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);
    const communityTax = Number(paramsResponse.data.params.community_tax);
    const annualProvisions = annualProvision.data.annual_provisions;
    const totalSupply = Number(total_Supply.data.supply[0].amount);

    const bondedRate = Number((bondedTokens / circulation_supply) * 100);
    const community_poolValue = community_pool?.data?.pool[0]?.amount ?? 0;

    return {
      annualProvisions,
      blocksPerYear,
      inflation,
      bondedTokens,
      communityTax,
      totalValidator,
      circulation_supply,
      bondedRate,
      total_supply: totalSupply,
      totalValidators: validatorResponse?.data?.validators.length,
      activeValidator: activeValidator.length,
      community_pool: community_poolValue,
    };
  } catch (error) {
    logger.error("getParams Error", error);
    return false;
  }
}


/**
 * Calculate the unlocked amount for a specific allocation at current time.
 *
 * This function handles three types of vesting schedules:
 * 1. Standard vesting: cliff period → linear vesting
 * 2. TGE unlock (Ecosystem): 10% at launch → cliff → linear vesting
 * 3. Delayed start (Team/Advisors): delayed start date → linear vesting
 *
 * @param name - Name of the allocation (used for special case handling)
 * @param alloc - Allocation configuration object
 * @param currentDate - Date to calculate unlocked amount for
 * @returns Amount of tokens unlocked at the given date
 */
export function getUnlocked(
	name: string,
	alloc: Allocation,
	currentDate: Date,
): number {
	const { total } = alloc;
	const tgePct = alloc.tge;

	// Determine cliff end date (no nested ternary)
	let cliffEnd: Date | null = null;

	if (alloc.delay) {
		cliffEnd = alloc.delay;
	} else if (alloc.cliff !== null) {
		cliffEnd = addMonths(NETWORK_LAUNCH, alloc.cliff);
	}

	// Determine vesting end date
	const vestEnd = cliffEnd ? addMonths(cliffEnd, alloc.vest) : null;

	// If no cliff end date, nothing is unlocked
	if (!cliffEnd) {
		return 0;
	}

	// Special case: Ecosystem has TGE unlock at network launch
	if (name === 'ecosystem' && tgePct > 0) {
		const tgeAmount = total * (tgePct / 100);

		if (currentDate < NETWORK_LAUNCH) {
			return 0;
		}

		if (currentDate < cliffEnd) {
			return tgeAmount;
		}

		if (vestEnd && currentDate >= vestEnd) {
			return total;
		}

		if (vestEnd) {
			const vestingAmount = total - tgeAmount;
			const progress =
				(currentDate.getTime() - cliffEnd.getTime()) /
				(vestEnd.getTime() - cliffEnd.getTime());

			return tgeAmount + vestingAmount * Math.min(1.0, progress);
		}
	}

	// Standard allocations (including Team / Advisors)

	if (currentDate < cliffEnd) {
		return 0;
	}

	if (vestEnd && currentDate >= vestEnd) {
		return total;
	}

	if (vestEnd) {
		const progress =
			(currentDate.getTime() - cliffEnd.getTime()) /
			(vestEnd.getTime() - cliffEnd.getTime());

		return total * Math.min(1.0, progress);
	}

	return 0;
}

/**
 * Get the cliff end date for an allocation.
 *
 * @param alloc - Allocation configuration
 * @returns Cliff end date or null if no cliff
 */
export function getCliffEndDate(alloc: Allocation): Date | null {
	if (alloc.delay) {
		return alloc.delay;
	}

	if (alloc.cliff === null) {
		return null;
	}

	return addMonths(NETWORK_LAUNCH, alloc.cliff);
}

/**
 * Get the vesting end date for an allocation.
 *
 * @param alloc - Allocation configuration
 * @returns Vesting end date or null if no vesting period
 */
export function getVestEndDate(alloc: Allocation): Date | null {
	const cliffEnd = getCliffEndDate(alloc);

	if (cliffEnd === null) {
		return null;
	}

	return addMonths(cliffEnd, alloc.vest);
}

export { calculateData };
