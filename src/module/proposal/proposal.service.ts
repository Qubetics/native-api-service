import prisma from "../../lib/db";
import { RES_MSG } from "../../constant";
import { IESResponse } from "../../interfaces";
import { noExponent } from "../../Utility/common";
import { convertBigIntToNumber } from "../../helper/common.helper";
import logger from "../../lib/logger";

class ProposalService {
  /**
   * get all proposal
   * @param data
   * @returns
   */
  async getAllProposals(data: {
    page: number;
    limit: number;
    status: string;
  }): Promise<IESResponse> {
    try {
      const hasStatusFilter =
        data.status === "voting" ||
        data.status === "deposit" ||
        data.status === "passed" ||
        data.status === "rejected" ||
        data.status === "failed";

      const [proposals, statusGroups, totalCount] = await Promise.all([
        prisma.proposals.findMany({
          orderBy: hasStatusFilter
            ? { votingStartTime: "desc" }
            : { votingEndTime: "desc" },
          skip: data.page * data.limit,
          take: data.limit,
          ...(hasStatusFilter ? { where: { status: data.status } } : {}),
        }),
        prisma.proposals.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
        prisma.proposals.count(),
      ]);

      const countByStatus = new Map(
        statusGroups.map((g) => [g.status, g._count.status]),
      );

      const votingCount = countByStatus.get("voting") ?? 0;
      const depositCount = countByStatus.get("deposit") ?? 0;
      const passedCount = countByStatus.get("passed") ?? 0;
      const rejectCount = countByStatus.get("rejected") ?? 0;
      const failedCount = countByStatus.get("failed") ?? 0;
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          totalCount,
          proposals: convertBigIntToNumber(proposals),
          depositCount,
          votingCount,
          passedCount,
          rejectCount,
          failedCount,
        },
      };
    } catch (err) {
      logger.error("error in getAllProposals", err);

      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getProposalById(proposalId: string): Promise<IESResponse> {
    try {
      let proposalData = await prisma.proposals.findUnique({
        where: { proposalId: proposalId },
      });

      proposalData = convertBigIntToNumber([proposalData])[0];

      if (!proposalData) throw new Error(RES_MSG.PROPOSAL_NOT_FOUND);
      return {
        error: false,
        message: RES_MSG.PROPOSAL_FETCH_SUCCESS,
        data: {
          proposal: proposalData,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  /**
   * get all voters
   * @param data
   * @returns
   */
  async getVotersById(data: {
    page: number;
    limit: number;
    answer: string;
    proposalId: string;
  }): Promise<IESResponse> {
    try {
      const hasAnswerFilter = [RES_MSG.YES, RES_MSG.NO, RES_MSG.VETO, RES_MSG.ABSTAIN].includes(
        data.answer,
      );

      const whereClause: { proposalId: string; answer?: string } = {
        proposalId: data.proposalId,
        ...(hasAnswerFilter ? { answer: data.answer } : {}),
      };

      // Single groupBy replaces 4 count queries; also confirms proposalId exists
      const [answerGroups, voters, totalCount] = await Promise.all([
        prisma.voters.groupBy({
          by: ["answer"],
          where: { proposalId: data.proposalId },
          _count: { answer: true },
        }),
        prisma.voters.findMany({
          orderBy: { blockNumber: "desc" },
          skip: data.page * data.limit,
          take: data.limit,
          where: whereClause,
        }),
        prisma.voters.count({ where: whereClause }),
      ]);

      if (answerGroups.length === 0 && totalCount === 0) {
        throw new Error(RES_MSG.NOT_FOUND);
      }

      const countByAnswer = new Map(
        answerGroups.map((g) => [g.answer, g._count.answer]),
      );

      const yesCount = countByAnswer.get(RES_MSG.YES) ?? 0;
      const noCount = countByAnswer.get(RES_MSG.NO) ?? 0;
      const vetoCount = countByAnswer.get(RES_MSG.VETO) ?? 0;
      const abstainCount = countByAnswer.get(RES_MSG.ABSTAIN) ?? 0;

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          totalCount,
          voters: convertBigIntToNumber(voters),
          yesCount,
          noCount,
          vetoCount,
          abstainCount,
        },
      };
    } catch (err) {
      logger.error("error in getAllVoters", err);

      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async searchVoterByAddress(data: {
    address: string;
    proposalId: string;
  }): Promise<IESResponse> {
    try {
      if (!data.address.startsWith("qubetics")) {
        throw new Error(RES_MSG.INVALID_ADDRESS);
      } else if (
        data.address.startsWith("qubetics") &&
        data.address.length > 42
      ) {
        const voters = await prisma.voters.findFirst({
          where: {
            voter: data.address,
            proposalId: data.proposalId,
          },
        });

        if (!voters) {
          throw new Error(RES_MSG.NOT_FOUND);
        }

        const votersData = {
          ...voters,
          blockNumber: voters.blockNumber.toString(),
        };
        return {
          error: false,
          message: RES_MSG.FETCH_SUCCESS,
          data: {
            voters: votersData,
          },
        };
      } else {
        throw new Error(RES_MSG.NOT_FOUND);
      }
    } catch (err) {
      if (err instanceof Error) {
        return { error: true, message: RES_MSG.NOT_FOUND };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async searchingProposals(data: {
    limit: number;
    page: number;
    value: string;
    status: string;
  }): Promise<IESResponse> {
    try {
      let proposals;
      let totalCount;

      // Check if the value is numeric
      if (/^\d+$/.test(data.value)) {
        const proposal = await prisma.proposals.findUnique({
          where: {
            proposalId: data.value,
            ...(data.status && { status: data.status }),
          },
        });
        if (!proposal) {
          throw new Error(RES_MSG.NOT_FOUND);
        }
        proposals = [proposal];
        totalCount = 1; // Only one unique proposal if found
      } else {
        // Calculate the total count of proposals that match the criteria
        totalCount = await prisma.proposals.count({
          where: {
            title: {
              contains: data.value,
              mode: "insensitive",
            },
            ...(data.status && { status: data.status }),
          },
        });

        if (totalCount === 0) {
          throw new Error(RES_MSG.NOT_FOUND);
        }

        // Fetch the proposals with pagination
        proposals = await prisma.proposals.findMany({
          skip: data.page * data.limit,
          take: data.limit,
          where: {
            title: {
              contains: data.value,
              mode: "insensitive",
            },
            ...(data.status && { status: data.status }),
          },
          orderBy: {
            votingStartTime: "desc",
          },
        });
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          proposals: proposals,
          totalCount: totalCount,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        return { error: true, message: RES_MSG.NOT_FOUND };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }
}
export default new ProposalService();
