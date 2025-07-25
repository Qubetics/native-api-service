import prisma from "../../lib/db";
import { subDays, startOfDay } from 'date-fns';
import { convertBigIntToNumber } from "../../helper/common.helper";
import { sessionsPath, daysMap, MSG_TYPE, subscriptionPath, RES_MSG, MSG_START_SESSION, MSG_CANCEL_SESSION, MSG_START_SUBSCRIPTION, MSG_CANCEL_SUBSCRIPTION } from "../../constant";

class MessageService {
    /**
     * Get all message data entries based on type filter
     * @param data
     * @returns
     */
    async getAllMessage(data: { txHash: string }): Promise<any> {
        try {
            const sessions = await prisma.dvpnTransaction.findMany({
                where: {
                    txhash: data.txHash,
                },
            });

            if (!sessions || sessions.length === 0) {
                return {
                    error: true,
                    message: RES_MSG.NOT_FOUND,
                    data: [],
                };
            }

            const session = sessions[0];
            const { type, sessionId, subscriptionId } = session;

            switch (type) {
                case MSG_START_SESSION:
                    return {
                        error: false,
                        message: RES_MSG.FETCH_SUCCESS,
                        data: { sessionEntries: convertBigIntToNumber([session]) },
                    };

                case MSG_CANCEL_SESSION:
                    if (sessionId) {
                        const relatedSessions = await prisma.dvpnTransaction.findMany({
                            where: {
                                sessionId,
                                type: {
                                    in: sessionsPath,
                                },
                            },
                            orderBy: { createdAt: "desc" },
                        });

                        return {
                            error: false,
                            message: RES_MSG.FETCH_SUCCESS,
                            data: { sessionEntries: convertBigIntToNumber(relatedSessions) },
                        };
                    }
                    break;

                case MSG_START_SUBSCRIPTION:
                    return {
                        error: false,
                        message: RES_MSG.FETCH_SUCCESS,
                        data: { sessionEntries: convertBigIntToNumber([session]) },
                    };

                case MSG_CANCEL_SUBSCRIPTION:
                    if (subscriptionId) {
                        const relatedSubscriptions = await prisma.dvpnTransaction.findMany({
                            where: {
                                subscriptionId,
                                type: {
                                    in: subscriptionPath,
                                },
                            },
                            orderBy: { createdAt: "desc" },
                        });

                        return {
                            error: false,
                            message: RES_MSG.FETCH_SUCCESS,
                            data: { sessionEntries: convertBigIntToNumber(relatedSubscriptions) },
                        };
                    }
                    break;

                default:
                    return {
                        error: false,
                        message: RES_MSG.INVALID_MESSAGE,
                        data: { sessionEntries: convertBigIntToNumber([session]) },
                    };
            }

            return {
                error: false,
                message: RES_MSG.INVALID_MESSAGE,
                data: { sessionEntries: convertBigIntToNumber([session]) },
            };
        } catch (error) {
            console.error("Error while fetching message:", error);
            return {
                error: true,
                message:
                    error instanceof Error
                        ? error.message.includes("prisma")
                            ? "Server Error"
                            : error.message
                        : "Unknown error",
            };
        }
    }


    async getUpTimeHistory(data: { nodeAddress: string; duration: string; }): Promise<any> {
        try {

            const days = daysMap[data.duration] || 7;
            const fromDate = subDays(new Date(), days);

            const transactions = await prisma.transactions.findMany({
                where: {
                    type: {
                        in: MSG_TYPE,
                    },
                    createdAt: {
                        gte: fromDate,
                    },
                    nodeAddress: data?.nodeAddress
                },
                select: {
                    value: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            });

            const grouped: Record<string, number> = {};

            for (const tx of transactions) {
                const dayKey = startOfDay(tx.createdAt).toISOString();
                const val = tx.value ? parseFloat(tx.value) : 0;

                if (!grouped[dayKey]) {
                    grouped[dayKey] = 0;
                }

                grouped[dayKey] += val;
            }

            const formatted = Object.entries(grouped).map(([timestamp, value]) => ({
                timestamp,
                count: parseFloat(value.toFixed(2)),
            }));

            return {
                error: false,
                message: "Fetched uptime history successfully",
                data: formatted,
            };
        } catch (error) {
            console.error("Error while fetching uptime history:", error);
            return {
                error: true,
                message:
                    error instanceof Error
                        ? error.message.includes("prisma")
                            ? "Server Error"
                            : error.message
                        : "Unknown error",
            };
        }
    }

}

export default new MessageService();
