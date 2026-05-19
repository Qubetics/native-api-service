import Web3 from "web3";
import prisma from "../../lib/db";
import { IESResponse } from "../../interfaces/index";
import { convertBigIntToNumber } from "../../helper/common.helper";
import { CONTRACT, CONTRACTLOGS, RES_MSG } from "../../constant/index";
import logger from "../../lib/logger";

class ContractService {
  async getAllContract(data: {
    page?: number;
    limit: number;
  }): Promise<IESResponse> {
    try {
      const isFirstPage = data.page === 1;
      const [contracts, contractCount] = await prisma.$transaction([
        prisma.contracts.findMany({
          where: isFirstPage ? {} : { id: { lt: data.page } },
          take: data.limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.contracts.count(),
      ]);
      if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
      const nextCursor =
        contracts.length === data.limit
          ? convertBigIntToNumber(contracts)[contracts.length - 1].id
          : null;
      const prevCursor = isFirstPage
        ? null
        : data.page && contracts.length > 0
          ? convertBigIntToNumber(contracts)[0].id + 11
          : null;

      return {
        error: false,
        message: RES_MSG.CONTRACT,
        data: {
          count: contractCount,
          contracts: convertBigIntToNumber(contracts),
          nextCursor,
          prevCursor,
        },
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getContractByAddress(contractAddress: string): Promise<IESResponse> {
    try {
      const contractData = await prisma.contracts.findFirst({
        where: {
          address: contractAddress,
        },
        select: {
          ...CONTRACT,
          Tokens: {
            select: {
              decimal: true,
              totalSupply: true,
              tokenSymbol: true,
            },
          },
        },
      });
      const contractCount = await prisma.contracts.count({
        where: { address: contractAddress },
      });

      const contractDataToSend = {
        ...contractData,
        decimal: contractData?.Tokens?.decimal ?? "",
        totalSupply: contractData?.Tokens?.totalSupply ?? "",
        symbol: contractData?.Tokens?.tokenSymbol ?? "",
        txCount: contractCount,
      };
      delete contractDataToSend.Tokens;
      const contract = convertBigIntToNumber([contractDataToSend])[0];

      return {
        error: false,
        message: RES_MSG.CONTRACT,
        data: {
          contracts: contract,
          isContractAddress: true,
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

  async getContractTransaction(data: {
    page: number;
    limit: number;
    contractAddress: string;
  }): Promise<IESResponse> {
    try {
      const [contractLogs, contractLogsCount] = await prisma.$transaction([
        prisma.contractLogs.findMany({
          skip: data.page * data.limit,
          take: data.limit,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            ...CONTRACTLOGS,
            transactions: {
              select: {
                toAddress: true,
                fromAddress: true,
              },
            },
          },
          where: {
            contractAddress: data.contractAddress,
          },
        }),
        prisma.contractLogs.count({
          where: {
            contractAddress: data.contractAddress,
          },
        }),
      ]);

      if (!contractLogs?.length) {
        const [contractTx, contractTxCount] = await prisma.$transaction([
          prisma.transactions.findMany({
            skip: data.page * data.limit,
            take: data.limit,
            orderBy: {
              createdAt: "desc",
            },
            where: {
              toAddress: data.contractAddress,
            },
          }),
          prisma.transactions.count({
            where: {
              toAddress: data.contractAddress,
            },
          }),
        ]);

        if (!contractTx?.length) throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);

        return {
          error: false,
          message: RES_MSG.CONTRACT_TX,
          data: {
            count: contractTxCount,
            contracts: convertBigIntToNumber(contractTx).map((item) => ({
              ...item,
              txHash: item.txhash,
              blockNumber: item.blocknumber,
            })),
          },
        };
      }
      const dataToSend: any = [];
      contractLogs.forEach((e: any) => {
        const data = {
          ...e,
          toAddress: e?.transactions?.toAddress || "",
          fromAddress: e?.transactions?.fromAddress || "",
        };
        delete data.transactions;
        dataToSend.push(data);
      });

      return {
        error: false,
        message: RES_MSG.CONTRACT_TX,
        data: {
          count: contractLogsCount,
          contracts: convertBigIntToNumber(dataToSend),
        },
      };
    } catch (err) {
      logger.error("error in getContractLogs", err);
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  // async getContractTransfer(data: {
  // 	page: number;
  // 	limit: number;
  // 	contractAddress: string;
  // }): Promise<IESResponse> {
  // 	try {
  // 		const [contractLogs, contractLogsCount] = await prisma.$transaction(
  // 			[
  // 				prisma.contractLogs.findMany({
  // 					skip: data.page * data.limit,
  // 					take: data.limit,
  // 					orderBy: {
  // 						createdAt: 'desc',
  // 					},
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 						methodSignature: '0xddf252ad',
  // 					},
  // 					select: {
  // 						...CONTRACTLOGS,
  // 						transactions: {
  // 							select: {
  // 								toAddress: true,
  // 								fromAddress: true,
  // 							},
  // 						},
  // 					},
  // 				}),
  // 				prisma.contractLogs.count({
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 						methodSignature: '0xddf252ad',
  // 					},
  // 				}),
  // 			],
  // 		);
  // 		if (!contractLogs?.length) throw new Error(RES_MSG.NOT_FOUND);

  // 		const dataToSend: any = [];
  // 		contractLogs.forEach((e: any) => {
  // 			const data = {
  // 				...e,
  // 				toAddress: e?.transactions?.toAddress || '',
  // 				fromAddress: e?.transactions?.fromAddress || '',
  // 			};
  // 			delete data.transactions;
  // 			dataToSend.push(data);
  // 		});
  // 		return {
  // 			error: false,
  // 			message: RES_MSG.CONTRACT_TX,
  // 			data: {
  // 				count: contractLogsCount,
  // 				contracts: convertBigIntToNumber(dataToSend),
  // 			},
  // 		};
  // 	} catch (err) {
  // 		if (err instanceof Error) {
  // 			if (err.message.includes('prisma')) {
  // 				return { error: true, message: RES_MSG.SERVER_ERROR };
  // 			}
  // 			return { error: true, message: err.message };
  // 		} else {
  // 			return { error: true, message: RES_MSG.ERROR };
  // 		}
  // 	}
  // }

  // async getContractEvents(data: {
  // 	page: number;
  // 	limit: number;
  // 	contractAddress: string;
  // }): Promise<IESResponse> {
  // 	try {
  // 		const [contractLogs, contractLogsCount] = await prisma.$transaction(
  // 			[
  // 				prisma.contractLogs.findMany({
  // 					skip: data.page * data.limit,
  // 					take: data.limit,
  // 					orderBy: {
  // 						createdAt: 'desc',
  // 					},
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 					},
  // 				}),
  // 				prisma.contractLogs.count({
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 					},
  // 				}),
  // 			],
  // 		);
  // 		if (!contractLogs?.length) throw new Error(RES_MSG.NOT_FOUND);
  // 		return {
  // 			error: false,
  // 			message: RES_MSG.CONTRACT_TX,
  // 			data: {
  // 				count: contractLogsCount,
  // 				contracts: convertBigIntToNumber(contractLogs),
  // 			},
  // 		};
  // 	} catch (err) {
  // 		console.log('error inside getContractEvents : ', err);
  // 		if (err instanceof Error) {
  // 			if (err.message.includes('prisma')) {
  // 				return { error: true, message: RES_MSG.SERVER_ERROR };
  // 			}
  // 			return { error: true, message: err.message };
  // 		} else {
  // 			return { error: true, message: RES_MSG.ERROR };
  // 		}
  // 	}
  // }

  // async getInternalTx(data: {
  // 	page: number;
  // 	limit: number;
  // 	contractAddress: string;
  // }): Promise<IESResponse> {
  // 	try {
  // 		const [contractLogs, contractLogsCount] = await prisma.$transaction(
  // 			[
  // 				prisma.contractLogs.findMany({
  // 					skip: data.page * data.limit,
  // 					take: data.limit,
  // 					orderBy: {
  // 						createdAt: 'desc',
  // 					},
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 					},
  // 				}),
  // 				prisma.contractLogs.count({
  // 					where: {
  // 						contractAddress: data.contractAddress,
  // 					},
  // 				}),
  // 			],
  // 		);
  // 		if (!contractLogs?.length)
  // 			throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);
  // 		return {
  // 			error: false,
  // 			message: RES_MSG.CONTRACT_TX,
  // 			data: {
  // 				count: contractLogsCount,
  // 				contracts: convertBigIntToNumber(contractLogs),
  // 			},
  // 		};
  // 	} catch (err) {
  // 		console.log('error inside getInternalTx : ', err);

  // 		if (err instanceof Error) {
  // 			if (err.message.includes('prisma')) {
  // 				return { error: true, message: RES_MSG.SERVER_ERROR };
  // 			}
  // 			return { error: true, message: err.message };
  // 		} else {
  // 			return { error: true, message: RES_MSG.ERROR };
  // 		}
  // 	}
  // }

  // async getPopularTx(data: {
  // 	page: number;
  // 	limit: number;
  // }): Promise<IESResponse> {
  // 	try {
  // 		const dbData = await prisma.contracts.findMany({
  // 			where: {
  // 				OR: [
  // 					{ contractType: 'ERC-20' },
  // 					{ contractType: 'ERC-721' },
  // 				],
  // 			},
  // 			orderBy: {
  // 				createdAt: 'desc',
  // 			},
  // 		});

  // 		const dataToReturn: any[] = [];

  // 		for (let i = 0; i < dbData.length; i++) {
  // 			const element = dbData[i];
  // 			const count = await prisma.contractLogs.count({
  // 				where: {
  // 					contractAddress: element.address,
  // 				},
  // 			});

  // 			if (count > 0) {
  // 				dataToReturn.push({
  // 					...element,
  // 					count,
  // 				});
  // 			}
  // 		}

  // 		const startIndex = data.page * data.limit;
  // 		const endIndex = startIndex + data.limit;
  // 		const paginatedResults = dataToReturn.slice(startIndex, endIndex);

  // 		if (!paginatedResults?.length) {
  // 			throw new Error(RES_MSG.NOT_FOUND);
  // 		}

  // 		const sortedContracts = paginatedResults.sort(
  // 			(a, b) => b.count - a.count,
  // 		);

  // 		return {
  // 			error: false,
  // 			message: RES_MSG.POPULAR_TX_SUCCESS,
  // 			data: {
  // 				totalCount: dataToReturn.length,
  // 				contracts: convertBigIntToNumber(sortedContracts),
  // 			},
  // 		};
  // 	} catch (err) {
  // 		console.log('error in getPopularTx : ', err);

  // 		if (err instanceof Error) {
  // 			if (err.message.includes('prisma')) {
  // 				return { error: true, message: RES_MSG.SERVER_ERROR };
  // 			}
  // 			return { error: true, message: err.message };
  // 		} else {
  // 			return { error: true, message: RES_MSG.ERROR };
  // 		}
  // 	}
  // }
}

export default new ContractService();
