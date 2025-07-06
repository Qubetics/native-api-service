import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  RES_MSG,
  CONST_NAME,
  REDIS_KEY,
  CURRENT_DEFAULT_APR,
} from "../constant";
import { Params, BlockHeader } from "../interfaces/index";
import logger from "../lib/logger";
import { getDigitsAfterE } from "../lib/utilities.helper";
import { RedisService } from "../service";

async function getParams(apiRes: AxiosInstance): Promise<any | false> {
  try {
    const [
      validatorResponse,
      circulationSupplyResponse,
      inflationRateResponse,
      poolResponse,
      paramsResponse,
      totalSupplyResponse,
    ] = await Promise.all([
      apiRes.get("/cosmos/staking/v1beta1/validators"),
      apiRes.get(
        `/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.symbol}`
      ),
      apiRes.get("/cosmos/mint/v1beta1/inflation"),
      apiRes.get("/cosmos/staking/v1beta1/pool"),
      apiRes.get("/cosmos/distribution/v1beta1/params"),
      apiRes.get("/cosmos/bank/v1beta1/supply"),
    ]);

    const validator = validatorResponse?.data?.validators.filter(
      (item: any) => item.status === CONST_NAME.BOND_STATUS
    );

    if (validator?.length === 0) {
      return false;
    }

    const circulation_supply: number =
      Number(circulationSupplyResponse.data.amount.amount) / CONST_NAME.ETH_EXP;

    const inflation: any = Number(inflationRateResponse.data.inflation);

    // const formattedInflationRate = `${inflation_rate}`;

    const annualProvisions = Number(circulation_supply * parseFloat(inflation));

    let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
    blocksPerYear = Number(blocksPerYear / 2);
    // const inflation = formattedInflationRate;

    const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);

    const totalSupply = totalSupplyResponse.data.supply[0].amount;

    const bondedRate = Number(((bondedTokens / totalSupply) * 100).toFixed(3));

    const communityTax = Number(paramsResponse.data.params.community_tax);

    return {
      annualProvisions,
      blocksPerYear,
      inflation,
      bondedTokens,
      communityTax,
      validator: validator?.length,
      circulation_supply,
      bondedRate,
      totalSupply,
      totalValidators: validatorResponse?.data?.validators.length,
    };
  } catch (error) {
    logger.log("error occurred while calculating stake APR", error);
    return false;
  }
}

// Calculate Annual Percentage Yield (APY) based on parameters
function calculateAPY(
  inflation: number,
  bondedRate: number,
  communityTax: number
): number {
  const apy = Number(
    ((inflation / bondedRate) * (1 - communityTax) * 100).toFixed(2)
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

    let apr = CURRENT_DEFAULT_APR;
    const params = await getParams(apiRes);
    if (!params) throw new Error(RES_MSG.FETCH_SUCCESS);
    try {
      const getApr = await apiRes.get("/qubetics/validatorpool/params");
      apr = getApr?.data?.params?.annual_roi;
    } catch (error) {
      console.log("Error while getng apr details", error);
    }

    const apyValue = calculateAPY(
      Number(params.inflation),
      Number(params.bondedRate),
      params.communityTax
    );

    const validatorData = {
      totalSupply: params?.totalSupply,
      inflation: Number(params?.inflation),
      apy: apyValue ?? CURRENT_DEFAULT_APR,
      totalValidator: params.validator,
      circulation_supply: params.circulation_supply,
      apr: apr.toString(),
      circulationSupply: params?.circulation_supply,
      validator: params?.activeValidator,
      bondedTokens: params?.bondedTokens,
      bondedRate: params?.bondedRate,
    };

    await RedisService.setString(
      REDIS_KEY.VALIDATOR_DATA,
      JSON.stringify(validatorData)
    );
    return validatorData;
  } catch (err) {
    logger.log("error", "Error occurred while calculating stake APY", err);
    if (err instanceof Error) {
      return { error: true, message: err.message };
    }
    return { error: true, message: RES_MSG.NOT_FOUND };
  }
};

export { calculateData };
