import { arrNoExponent, fetchRequest, noExponent } from "../../Utility/common";
import { FETCH_METHODS, HEADERS, REDIS_KEY, RES_MSG } from "../../constant";
import { IESResponse } from "../../interfaces/index";
import prisma from "../../lib/db";
import { RedisService } from "../../service/index";

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
      console.log("dataToSend: ", dataToSend);

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: delegatorCount,
          delegator: dataToSend,
        },
      };
    } catch (err) {
      console.log("error in getAllDelegators : ", err);
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

      let validatorsTotalReward = 0;
      if (delegatorByAddress?.validatorStakes) {
        for (const validatorStake of delegatorByAddress?.validatorStakes) {
          let validator = await prisma.validator.findUnique({
            where: {
              operatorAddress: validatorStake?.validatorOperatorAddress,
            },
            select: {
              totalRewards: true,
              name: true,
              validatorAddress: true,
            },
          });

          if (validator) {
            validatorsTotalReward = Number(validator?.totalRewards);
          }

          validatorStake.validatorsTotalReward = validatorsTotalReward;
          validatorStake.delegatorRewards = Number(
            validatorStake.delegatorRewards
          );
          validatorStake.name = validator?.name || "";
          validatorStake.validatorAddress = validator?.validatorAddress || "";
          validatorStake.stake = noExponent(
            validatorStake?.stake / 10 ** 18 || 0
          );
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
      console.log("error in getDelegatorByAddress : ", err);
      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async dashboard(address: string): Promise<IESResponse> {
    try {
      // const addressKey = `${REDIS_KEY.TOTAL_REWARDS}:${address}`;
      // let totalRewardsResponse;

      // const response = await fetchRequest(
      //   `${environment.evmHost}/cosmos/distribution/v1beta1/delegators/${address}/rewards`,
      //   FETCH_METHODS.GET,
      //   HEADERS.DEFAULT
      // );

      // console.log("response  from blockchain :::: ", response.data.total[0]?.amount);
      // if (!response.error) {
      //   totalRewardsResponse = response.data.total[0]?.amount || 0;
      //   await RedisService.setString(addressKey, totalRewardsResponse);
      // } else {
      //   totalRewardsResponse = await RedisService.getString(addressKey);
      // }

      // let totalRewards = totalRewardsResponse / 10 ** 18; // Update totalRewards,

      const delegatorByAddress = await prisma.validatorStake.findMany({
        where: {
          delegatorAddress: address,
        },
        select: { balanceAmount: true, delegatorRewards: true },
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
          totalRewards: totalRewards || 0,
          totalStake: delegatorStake,
        },
      };
    } catch (err) {
      console.log("error in getDelegatorByAddress : ", err);
      if (err instanceof Error) {
        return { error: true, message: "Something went wrong! " };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
  async getUnbondingDetails(address: string): Promise<IESResponse> {
    try {
      // const addressKey = `${REDIS_KEY.TOTAL_REWARDS}:${address}`;
      // let totalRewardsResponse;

      const response = await fetchRequest(
        `${environment.evmHost}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`,
        FETCH_METHODS.GET,
        HEADERS.DEFAULT
      );

      if (response?.error)
        return {
          error: true,
          message: RES_MSG.ERROR,
        };

      const modifiedResponse = await Promise.all(
        response.data?.unbonding_responses.map(async (item: any) => {
          const validator = await prisma.validator.findUnique({
            where: { operatorAddress: item.validator_address },
            select: { name: true },
          });

          return {
            validator_name: validator?.name || null,
            ...item,
          };
        })
      );

      console.log("modifiedResponse : ", modifiedResponse);

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: modifiedResponse,
      };
    } catch (err) {
      console.log("error in getDelegatorByAddress : ", err);
      if (err instanceof Error) {
        return { error: true, message: "Something went wrong! " };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
}

export default new DelegatorService();
