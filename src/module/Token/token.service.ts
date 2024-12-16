import prisma from '../../lib/db';
import { RES_MSG } from '../../constant/index';
import { HolderData, IESResponse } from '../../interfaces/index';
import { convertBigIntToNumber } from '../../helper/common.helper';

class TokenService {
	/**
	 * get all tokens
	 * @param data
	 * @returns
	 */
	async getAllTokens(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [tokens, tokensCount] = await prisma.$transaction([
				prisma.tokens.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
				}),
				prisma.tokens.count(),
			]);
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: tokensCount,
					tokens: convertBigIntToNumber(tokens),
					native: true,
				},
			};
		} catch (err) {
			console.log('err in getAllTokens : ', err);
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getTokenDetailsByAddress(data: {
		page: number;
		limit: number;
		address: string;
	}): Promise<IESResponse> {
		try {
			const holdersData: any = await prisma.holders.findMany({
				skip: data.page * data.limit,
				take: data.limit,
				select: {
					contractAddress: true,
					tokenBalance: true,
					contract: {
						select: {
							contractType: true,
							Tokens: {
								select: {
									decimal: true,
									tokenSymbol: true,
									tokenName: true,
								},
							},
						},
					},
				},
				where: {
					address: data?.address,
				},
			});

			const holdersCount = await prisma.holders.count({
				where: {
					address: data.address,
				},
			});

			const contractDetails: {
				tokenName: String;
				tokenType: String;
				tokenSymbol: String;
				tokenBalance: Number;
				contractAddress: String;
			}[] = [];
			for (const i of holdersData) {
				const dataToPush = {
					...i,

					tokenType: i?.contract?.contractType ?? '',
					tokenSymbol: i?.contract?.Tokens?.tokenSymbol ?? '',
					decimals: i?.contract?.Tokens?.decimal,
					tokenName: i?.contract?.Tokens?.tokenName,
				};
				delete dataToPush?.contract;
				contractDetails.push(dataToPush);
			}
			const dataToReturn = {
				count: holdersCount,
				tokenDetails: convertBigIntToNumber(contractDetails),
			};
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: dataToReturn,
			};
		} catch (err) {
			console.log('Error in getTokenByAddress: ', err);

			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}
}

export default new TokenService();
