import prisma from "../../lib/db";
import { CONST_NAME, RES_MSG } from "../../constant";
import { IESResponse } from "../../interfaces";
import { noExponent } from "../../Utility/common";
import { convertBigIntToNumber } from "../../helper/common.helper";
import logger from "../../lib/logger";
import axios from "axios";

class ValidatorService {
  /**
   * get all validator
   * @param data
   * @returns
   */
  async getAllValidators(data: {
    page: number;
    limit: number;
    status: string;
  }): Promise<IESResponse> {
    try {
      const excludedAddresses = environment.excludedValidators.split(",");

      const whereClause =
        data.status === "active" ||
        data.status === "deactivating" ||
        data.status === "inactive"
          ? { status: data.status }
          : {};

      const [
        validators,
        activeValidators,
        activeCount,
        inactiveCount,
        deactivatingCount,
        validatorCount,
      ] = await Promise.all([
        prisma.validator.findMany({
          orderBy: { votingPower: "desc" },
          skip: data.page * data.limit,
          take: data.limit,
          where: whereClause,
        }),
        prisma.validator.findMany({
          orderBy: { votingPower: "desc" },
          where: { status: "active" },
          select: {
            id: true,
            name: true,
            validatorAddress: true,
            operatorAddress: true,
            status: true,
            votingPower: true,
            commissionRate: true,
            delegatorCount: true,
            totalStake: true,
            jailed: true,
          },
        }),
        prisma.validator.count({ where: { status: "active" } }),
        prisma.validator.count({ where: { status: "inactive" } }),
        prisma.validator.count({ where: { status: "deactivating" } }),
        prisma.validator.count(),
      ]);

      // Filter out excluded addresses
      const filteredValidators = validators.filter(
        (validator) =>
          validator.validatorAddress &&
          !excludedAddresses.includes(validator.validatorAddress),
      );

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: validatorCount,
          validators: convertBigIntToNumber(filteredValidators),
          activeCount,
          inactiveCount,
          deactivatingCount,
          activeValidators: convertBigIntToNumber(activeValidators),
        },
      };
    } catch (err) {
      logger.error("error in getAllValidators", err);

      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  /**
   * get validator by address
   * @param address
   * @returns
   */
  async getValidatorsByAddress(address: string): Promise<IESResponse> {
    try {
      let validatorsDetailsByAddress = await prisma.validator.findUnique({
        where: {
          validatorAddress: address,
        },
      });
      if (!validatorsDetailsByAddress) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          validators: convertBigIntToNumber([validatorsDetailsByAddress]),
          count: 1,
        },
      };
    } catch (err) {
      logger.error("error in getValidatorsByAddress", err);

      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  /**
   * get validator by name
   * @param address
   * @returns
   */
  async getValidatorsByName(data: {
    limit: number;
    page: number;
    searchTerm: string;
  }): Promise<IESResponse> {
    try {
      const nameFilter = { name: { contains: data.searchTerm, mode: "insensitive" as const } };

      const [validatorsDetailsByName, validatorCount]: [any, number] = await Promise.all([
        prisma.validator.findMany({
          where: nameFilter,
          orderBy: { createdAt: "desc" },
          skip: data.page * data.limit,
          take: data.limit,
        }),
        prisma.validator.count({ where: nameFilter }),
      ]);

      if (!validatorsDetailsByName.length) {
        throw new Error(RES_MSG.NOT_FOUND);
      }
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          validators: convertBigIntToNumber(validatorsDetailsByName),
          count: validatorCount,
        },
      };
    } catch (err) {
      logger.error("error in getValidatorsByName", err);
      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  /**
   * validator search by address or name of validator
   * @param data
   * @returns
   */
  async getValidatorSearch(data: {
    limit: number;
    page: number;
    searchTerm: string;
  }): Promise<IESResponse> {
    try {
      if (data.searchTerm.length >= 42) {
        return await this.getValidatorsByAddress(data.searchTerm);
      } else {
        return await this.getValidatorsByName(data);
      }
    } catch (err) {
      logger.error("error in getValidatorSearch", err);

      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
  /**
   * get validator details
   * @param address
   * @returns
   */
  async getValidatorDetails(address: string): Promise<IESResponse> {
    try {
      const validatorData = await prisma.validator.findUnique({
        select: {
          totalRewards: true,
          operatorAddress: true,
          delegatorCount: true,
          selfStake: true,
        },
        where: { validatorAddress: address },
      });

      if (!validatorData) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      const [lastBlockProposed, totalBlockProposed, validatorStakeDetails] =
        await Promise.all([
          prisma.blocks.findFirst({
            select: { blocknumber: true },
            orderBy: { createdAt: "desc" },
            where: { miner: address },
          }),
          prisma.validatedBlocksCount.findUnique({
            select: { count: true },
            where: { operatorAddress: validatorData.operatorAddress },
          }),
          prisma.validatorStake.findMany({
            where: {
              validatorOperatorAddress: validatorData.operatorAddress,
            },
            select: { stake: true, delegator: true },
          }),
        ]);

      const delegatorStake = validatorStakeDetails.reduce(
        (total, element) => total + Number(element.stake),
        0,
      );

      const dataToSend = {
        delegatorStake,
        lastBlockProposed: lastBlockProposed?.blocknumber || 0,
        totalBlockProposed: totalBlockProposed?.count || 0,
        totalRewards: noExponent(validatorData?.totalRewards || 0),
        delegatorCount: validatorData?.delegatorCount || 0,
        selfStake: validatorData?.selfStake || 0,
      };

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: convertBigIntToNumber([dataToSend])[0],
      };
    } catch (err) {
      logger.error("error in getValidatorDetails", err);

      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getqubeticsValidators(data: {
    page: number;
    limit: number;
    status: string;
  }): Promise<IESResponse> {
    try {
      const validatorsString = environment.validators;

      let validator: string[] = [];
      if (validatorsString) {
        validator = validatorsString.split(",");
      }

      const apiUrl = environment.evmHost;

      const results = await Promise.allSettled(
        validator.map((validatorAddr) =>
          axios(`${apiUrl}/cosmos/staking/v1beta1/validators/${validatorAddr}`),
        ),
      );

      const BOND_STATUS_MAP: Record<string, string> = {
        BOND_STATUS_BONDED: "active",
        BOND_STATUS_UNBONDED: "inactive",
        BOND_STATUS_UNBONDING: "deactivating",
      };

      const filteredValidators = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => {
          const validatorData = r.value.data.validator;
          const status = BOND_STATUS_MAP[validatorData.status] ?? "unknown";
          return { ...validatorData, status };
        })
        .filter((v) => !data.status || v.status === data.status);

      if (filteredValidators.length === 0) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          validators: filteredValidators,
        },
      };
    } catch (err) {
      logger.error("error in getAllValidators", err);

      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
}
export default new ValidatorService();
