import prisma from "../../lib/db";
import { CONST_NAME, RES_MSG } from "../../constant";
import { IESResponse } from "../../interfaces";
import { noExponent } from "../../Utility/common";
import { convertBigIntToNumber } from "../../helper/common.helper";
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
          orderBy: { createdAt: "desc" },
          where: { status: "active" },
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
      console.log("error in getAllValidators : ", err);

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
      console.log("error in getValidatorsByAddress : ", err);

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
      const validatorsDetailsByName: any = await prisma.validator.findMany({
        where: {
          name: {
            contains: data.searchTerm,
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: data.page * data.limit,
        take: data.limit,
      });
      if (!validatorsDetailsByName.length) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      const validatorCount = await prisma.validator.count({
        where: {
          name: {
            contains: data.searchTerm,
          },
        },
      });
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          validators: convertBigIntToNumber(validatorsDetailsByName),
          count: validatorCount,
        },
      };
    } catch (err) {
      console.log("error in getValidatorsByName : ", err);
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
      console.log("error in getValidatorSearch : ", err);

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
      console.log("vaddress", address);
      const validatorData = await prisma.validator.findUnique({
        select: {
          totalRewards: true,
          operatorAddress: true,
          delegatorCount: true,
          selfStake: true,
        },
        where: { validatorAddress: address },
      });

      console.log(validatorData, "validatorData");
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
      console.log("error in getValidatorDetails : ", err);

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

      let filteredValidators = [];

      for (let i = 0; i < validator.length; i++) {
        const validatorAddr = validator[i];

        const apiUrl = environment.evmHost;

        const response = await axios(
          `${apiUrl}/cosmos/staking/v1beta1/validators/${validatorAddr}`,
        );

        const validatorData = response.data.validator;

        // Map status to 'active', 'inactive', or 'deactivating'
        let status;
        switch (validatorData.status) {
          case "BOND_STATUS_BONDED":
            status = "active";
            break;
          case "BOND_STATUS_UNBONDED":
            status = "inactive";
            break;
          case "BOND_STATUS_UNBONDING":
            status = "deactivating";
            break;
          default:
            status = "unknown";
        }

        // Check if the validator matches the requested status
        if (!data.status || status === data.status) {
          filteredValidators.push({ ...validatorData, status });
        }
      }

      // Check if any validators were found with the requested status
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
      console.log("error in getAllValidators : ", err);

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
