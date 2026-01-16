import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  RES_MSG,
  CONST_NAME,
  REDIS_KEY,
  CURRENT_DEFAULT_APR,
  STATIC_BURNED_AMOUNT,
} from "../constant";
import { Params, BlockHeader } from "../interfaces/index";
import logger from "../lib/logger";
import { getDigitsAfterE } from "../lib/utilities.helper";
import { RedisService } from "../service";

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
      totalSupply?: number;
      inflation?: number;
      apy?: number;
      circulation_supply?: number;
    }
  | { error: boolean; message: string }
> => {
  try {
    const cachedData = await RedisService.getString(REDIS_KEY.VALIDATOR_DATA);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      // Cache for 5 minutes (300000ms)
      if (Date.now() - (parsed.timestamp || 0) < 300000) {
        return parsed;
      }
    }

    const apiUrl = environment.evmHost;
    const apiRes = axios.create({
      baseURL: apiUrl,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      timeout: 5 * CONST_NAME.THOUSAND,
    });

    const [params, getAprRes] = await Promise.all([
      getParams(apiRes),
      apiRes.get("/qubetics/validatorpool/params").catch(err => {
        logger.error("Error fetching APR params", err);
        return null;
      })
    ]);

    let apr = CURRENT_DEFAULT_APR;
    if (!params) throw new Error(RES_MSG.FETCH_SUCCESS);

    const annualRoi = getAprRes?.data?.params?.annual_roi;
    if (annualRoi != null) {
      apr = annualRoi / 100;
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
      timestamp: Date.now()
    };

    await RedisService.setString(
      REDIS_KEY.VALIDATOR_DATA,
      JSON.stringify(validatorData),
    );
    return validatorData;
  } catch (err) {
    logger.error("Error occurred while calculating stake APY", err);
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
    const totalSupply = environment.initialSupply - Number(STATIC_BURNED_AMOUNT);

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

export { calculateData };
