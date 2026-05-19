import { arrNoExponent, fetchRequest, noExponent } from "../../Utility/common";
import { FETCH_METHODS, HEADERS, REDIS_KEY, RES_MSG } from "../../constant";
import { IESResponse } from "../../interfaces/index";
import prisma from "../../lib/db";
import logger from "../../lib/logger";
import redisHelper from "../../service/redis.helper";

class DelegatorService {
  /**
   * get all delegators
   * @param data
   * @returns
   */
  async getAllDelegators(data: {
    page: number;
    limit: number;
  }): Promise<IESResponse> {
    try {
      const [delegator, delegatorCount] = await prisma.$transaction([
        prisma.delegator.findMany({
          orderBy: {
            totalStake: "asc",
          },
          select: {
            address: true,
            totalStake: true,
            validatorStakes: {
              select: {
                stake: true,
                denom: true,
                balanceAmount: true,
                validatorOperatorAddress: true,
              },
            },
          },
          skip: data.page * data.limit,
          take: data.limit,
        }),
        prisma.delegator.count(),
      ]);

      if (!delegator?.length) throw new Error(RES_MSG.NOT_FOUND);
      const dataToSend: {
        address: string;
        totalStake: string;
        validatorStakes: {
          id: string;
          stake: string;
          validatorAddress: string;
          balanceAmount: string;
          denom: string;
        }[];
      }[] = [];
      delegator.forEach((element) => {
        dataToSend.push({
          address: element.address,
          totalStake: noExponent(Number(element.totalStake)),
          validatorStakes: arrNoExponent(element?.validatorStakes),
        });
      });
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: delegatorCount,
          delegator: dataToSend,
        },
      };
    } catch (err) {
      logger.error("error in getAllDelegators", err);
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
   * get delegator by delegator address
   * @param address
   * @returns
   */
  async getDelegatorByAddress(address: string): Promise<IESResponse> {
    try {
      let delegatorByAddress: any = await prisma.delegator.findUnique({
        where: {
          address,
        },
        select: {
          totalStake: true,
          createdAt: true,
          validatorStakes: true,
        },
      });

      if (!delegatorByAddress) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      if (delegatorByAddress?.validatorStakes?.length) {
        const operatorAddresses = delegatorByAddress.validatorStakes.map(
          (vs: any) => vs.validatorOperatorAddress,
        );

        const validators = await prisma.validator.findMany({
          where: { operatorAddress: { in: operatorAddresses } },
          select: { operatorAddress: true, totalRewards: true, name: true, validatorAddress: true },
        });

        const validatorMap = new Map(
          validators.map((v) => [v.operatorAddress, v]),
        );

        for (const validatorStake of delegatorByAddress.validatorStakes) {
          const validator = validatorMap.get(validatorStake.validatorOperatorAddress);
          validatorStake.validatorsTotalReward = validator ? Number(validator.totalRewards) : 0;
          validatorStake.delegatorRewards = Number(validatorStake.delegatorRewards);
          validatorStake.name = validator?.name || "";
          validatorStake.validatorAddress = validator?.validatorAddress || "";
          validatorStake.stake = noExponent(validatorStake?.stake / 10 ** 18 || 0);
        }
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          totalStake: noExponent(Number(delegatorByAddress?.totalStake) || ""),
          validatorStakes: arrNoExponent(delegatorByAddress?.validatorStakes),
        },
      };
    } catch (err) {
      logger.error("error in getDelegatorByAddress", err);
      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async dashboard(address: string): Promise<IESResponse> {
    try {
      let rewards = await redisHelper.getHset(REDIS_KEY.REWARDS, address);

      if (!rewards) {
        rewards = await prisma.rewards.findFirst({
          where: {
            address: address,
          },
          select: {
            rewardAmount: true,
          },
        });
      }

      const delegatorByAddress: any = await prisma.validatorStake.findMany({
        where: {
          delegatorAddress: address,
        },
        select: {
          balanceAmount: true,
          delegatorRewards: true,
        },
      });

      let totalRewards = 0;

      for (let i = 0; i < delegatorByAddress?.length; i++) {
        const element = delegatorByAddress[i];
        totalRewards = totalRewards + Number(element?.delegatorRewards);
      }
      let delegatorStake = 0;

      for (let i = 0; i < delegatorByAddress?.length; i++) {
        const element = delegatorByAddress[i];
        delegatorStake = delegatorStake + Number(element?.balanceAmount);
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          claimedRewards: rewards?.rewardAmount || 0,
          totalRewards: totalRewards || 0,
          totalStake: delegatorStake,
        },
      };
    } catch (err) {
      logger.error("error in getDelegatorByAddress", err);
      if (err instanceof Error) {
        return { error: true, message: "Something went wrong! " };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
  async getUnbondingDetails(address: string): Promise<IESResponse> {
    try {
      const response = await fetchRequest(
        `${environment.evmHost}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`,
        FETCH_METHODS.GET,
        HEADERS.DEFAULT,
      );

      if (response?.error)
        return {
          error: true,
          message: RES_MSG.ERROR,
        };

      const unbondingResponses = response.data?.unbonding_responses ?? [];

      const validatorAddresses = unbondingResponses.map(
        (item: any) => item.validator_address,
      );

      const validators = await prisma.validator.findMany({
        where: { operatorAddress: { in: validatorAddresses } },
        select: { operatorAddress: true, name: true },
      });

      const validatorNameMap = new Map(
        validators.map((v) => [v.operatorAddress, v.name]),
      );

      const modifiedResponse = unbondingResponses.map((item: any) => ({
        validator_name: validatorNameMap.get(item.validator_address) || null,
        ...item,
      }));

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: modifiedResponse,
      };
    } catch (err) {
      logger.error("error in getDelegatorByAddress", err);
      if (err instanceof Error) {
        return { error: true, message: "Something went wrong! " };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
}

export default new DelegatorService();
