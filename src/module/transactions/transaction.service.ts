import prisma from "../../lib/db";
import { ICreateTransaction, IESResponse } from "../../interfaces";
import { MSG_TYPE, REDIS_KEY, RES_MSG } from "../../constant";
import { convertBigIntToNumber } from "../../helper/common.helper";
import { RedisService } from "../../service";

class TransactionService {
  /**
   * get all transaction
   * @param data
   * @returns
   */
  async getAllTransactions_1(data: {
    page?: number;
    limit: number;
  }): Promise<IESResponse> {
    try {
      const isFirstPage = data.page === 1;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const [transactions, previous30DaysTrxn] = await prisma.$transaction([
        prisma.transactions.findMany({
          orderBy: {
            createdAt: "desc",
          },
          where: isFirstPage ? {} : { id: { lt: data.page } },
          take: data.limit,
        }),
        prisma.transactions.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo, // Greater than or equal to 30 days ago
            },
          },
        }),
      ]);

      const transactionCount = await RedisService.getString(
        REDIS_KEY.NATIVE_TRANSACTIONS_COUNT,
      );
      if (!transactions?.length) throw new Error(RES_MSG.NOT_FOUND);
      const nextCursor =
        transactions.length === data.limit
          ? convertBigIntToNumber(transactions)[transactions.length - 1].id
          : null;
      const prevCursor = isFirstPage
        ? null
        : data.page && transactions.length > 0
          ? convertBigIntToNumber(transactions)[0].id + 11
          : null;

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: transactionCount,
          transactions: convertBigIntToNumber(transactions),
          nextCursor,
          prevCursor,
          previous30DaysTrxn,
        },
      };
    } catch (err) {
      console.log("error in get getAllTransactions_1 : ", err);

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
   * get transaction details
   * @param address
   * @returns
   */
  async getTransactionsByAddress(data: {
    page: number;
    limit: number;
    address: string;
  }): Promise<IESResponse> {
    try {
      const [transactions, transactionCount] = await prisma.$transaction([
        prisma.transactions.findMany({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            OR: [
              {
                fromAddress: data.address,
              },
              {
                toAddress: data.address,
              },
            ],
          },

          skip: data.page * data.limit,
          take: data.limit,
        }),
        prisma.transactions.count({
          where: {
            OR: [
              {
                fromAddress: data.address,
              },
              {
                toAddress: data.address,
              },
            ],
          },
        }),
      ]);
      if (!transactions?.length) throw new Error(RES_MSG.NOT_FOUND);
      const updatedTransactions = convertBigIntToNumber(transactions);

      const isContractAddress = updatedTransactions.some(
        (transaction) => transaction.contractAddress === data.address,
      );

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          addresses: convertBigIntToNumber(transactions),
          count: transactionCount,
          transactions: convertBigIntToNumber(transactions),
          isContractAddress,
        },
      };
    } catch (err) {
      console.log("error in getTransactionsByAddress : ", err);
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.SERVER_ERROR };
        }
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getTransactionByHash(txHash: string): Promise<IESResponse> {
    try {
      let transactionData = await prisma.transactions.findUnique({
        where: { txhash: txHash },
      });

      transactionData = convertBigIntToNumber([transactionData])[0];

      if (!transactionData) throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);
      return {
        error: false,
        message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
        data: {
          transaction: transactionData,
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

  async getTransactionByBlock(payloads: {
    page: number;
    limit: number;
    value: string;
  }): Promise<IESResponse> {
    try {
      let blockNumber: number | undefined;
      let transactionData;
      let txCount;

      // Determine if the input is a block hash or a block number
      if (payloads.value.startsWith("0x") && payloads.value.length === 66) {
        // Query block number from block hash
        const block = await prisma.blocks.findFirst({
          where: { blockhash: payloads.value },
          select: { blocknumber: true },
        });

        if (!block) {
          return { error: true, message: RES_MSG.NOT_VALID_QUERY };
        }

        blockNumber = Number(block.blocknumber);
      } else {
        blockNumber = +payloads.value;
      }

      // Fetch transactions based on the determined block number
      transactionData = await prisma.transactions.findMany({
        where: { blocknumber: blockNumber },
        orderBy: { createdAt: "desc" },
        skip: payloads.page * payloads.limit,
        take: payloads.limit,
      });

      if (transactionData.length === 0) {
        throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);
      }

      // Get transaction count
      txCount = await prisma.blocks.findUnique({
        select: { transactionCount: true },
        where: { blocknumber: blockNumber },
      });

      return {
        message: RES_MSG.BLOCK_TRANSACTION_FETCH,
        error: false,
        data: {
          transaction: convertBigIntToNumber(transactionData),
          count: txCount
            ? convertBigIntToNumber([txCount])[0].transactionCount
            : 0,
        },
      };
    } catch (err) {
      console.log(err);

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

  /**
   * Create a new transaction
   * @param data
   * @returns
   */
  async createTransaction(
    txHash: string,
    data: ICreateTransaction,
  ): Promise<IESResponse> {
    try {
      let currentDate = Date.now().toString();

      const createdTransaction = await prisma.transactions.create({
        data: {
          type: data.type || "",
          status: data.status || "",
          txString: data.txString || "",
          blocknumber: data.blocknumber || 0,
          txhash: txHash || "",
          timestamp: currentDate || "",
          fromAddress: data.fromAddress || "",
          toAddress: data.toAddress || "",
          gasWanted: data.gasWanted || 0,
          txFee: data.txFee || "",
          value: data.value || "0",
        },
      });
      // Convert BigInt values to strings or numbers
      const processedTransaction = {
        ...createdTransaction,
        blocknumber: createdTransaction.blocknumber.toString(), // Convert to string
        gasWanted: Number(createdTransaction.gasWanted), // Convert to number
        txFee: Number(createdTransaction.txFee), // Convert to number
      };
      return {
        error: false,
        message: RES_MSG.TRANSACTION_CREATE_SUCCESS,
        data: processedTransaction,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.TRANSACTION_FAILED };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  /**
   * Update a transaction by txhash
   * @param txhash
   * @param data
   * @returns
   */
  async updateTransaction(
    txHash: string,
    data: ICreateTransaction,
  ): Promise<IESResponse> {
    try {
      console.log(data, "data");
      // Check if transaction with given txhash exists
      const existingTransaction = await prisma.transactions.findUnique({
        where: {
          txhash: txHash,
        },
      });
      console.log(existingTransaction, "existingTransaction");

      if (!existingTransaction) {
        // Transaction not found, create a new transaction
        return await this.createTransaction(txHash, data);
      } else {
        let transaction;
        transaction = await prisma.transactions.update({
          where: {
            txhash: txHash,
          },
          data: {
            type: data.type || "",
            status: data.status || "",
            txString: data.txString || "",
            blocknumber: data.blocknumber || 0,
            fromAddress: data.fromAddress || "",
            toAddress: data.toAddress || "",
            gasWanted: data.gasWanted || 0,
            txFee: data.txFee || "0",
            value: data.value || "0",
          },
        });

        // Convert BigInt values to strings or numbers
        const processedTransaction = {
          ...transaction,
          blocknumber: transaction.blocknumber.toString(), // Convert to string
          gasWanted: Number(transaction.gasWanted), // Convert to number
          txFee: Number(transaction.txFee), // Convert to number
        };
        return {
          error: false,
          message: RES_MSG.SUCCESS,
          data: processedTransaction,
        };
      }
    } catch (err) {
      if (err instanceof Error) {
        console.log("err ", err);
        if (err.message.includes("prisma")) {
          return { error: true, message: RES_MSG.TRANSACTION_FAILED };
        }
        return { error: true, message: err.message };
      } else {
        return { error: true, message: RES_MSG.ERROR };
      }
    }
  }

  async getAllTransactions(data: {
    page: number;
    limit: number;
    order: any;
  }): Promise<IESResponse> {
    try {
      const [
        cachedTxCount,
        cachedActiveAccount,
        cached30DaysTrxn,
        cachedMinMax,
      ] = await Promise.all([
        RedisService.getString(REDIS_KEY.NATIVE_TRANSACTIONS_COUNT),
        RedisService.getString(REDIS_KEY.ACTIVE_ACCOUNTS_TODAY),
        RedisService.getString(REDIS_KEY.TRANSACTIONS_30_DAYS),
        RedisService.getString("TX_MIN_MAX_IDS"),
      ]);

      let transactionCount = Number(cachedTxCount);
      if (!cachedTxCount) {
        transactionCount = await prisma.transactions.count();
        await RedisService.setStringWithExpiry(
          REDIS_KEY.NATIVE_TRANSACTIONS_COUNT,
          transactionCount.toString(),
          300,
        );
      }

      let transactionsData: any;
      let maxId: any = 0;
      let minId: any = 0;

      // Parallelize main data fetch and metadata calculation if needed
      if (data.order === "asc") {
        const [pData, aggRes] = await Promise.all([
          this.ascPagination(data.page, data.limit),
          cachedMinMax
            ? JSON.parse(cachedMinMax)
            : prisma.transactions.aggregate({ _max: { id: true } }),
        ]);
        transactionsData = pData;
        maxId = (aggRes as any)._max?.id || aggRes.maxId;
      } else {
        const [pData, minIdRes] = await Promise.all([
          this.descPagination(data.page, data.limit),
          cachedMinMax
            ? JSON.parse(cachedMinMax)
            : prisma.transactions.findMany({
                select: { id: true },
                orderBy: { id: "asc" },
                take: (transactionCount % data.limit) + 1 || data.limit + 1,
              }),
        ]);
        transactionsData = pData;
        minId = (minIdRes as any).minId || minIdRes;
      }

      // Cache Min/Max if we just fetched them
      if (!cachedMinMax) {
        // Only cache if we have some data
        const minMaxToCache = data.order === "asc" ? { maxId } : { minId };
        await RedisService.setStringWithExpiry(
          "TX_MIN_MAX_IDS",
          JSON.stringify(minMaxToCache),
          600,
        );
      }

      const { transactions, nextCursor, prevCursor } = transactionsData;
      let nextCursorValue: number | null = nextCursor;

      // Handle other counts with caching
      let activeAccount = Number(cachedActiveAccount);
      let previous30DaysTrxn = Number(cached30DaysTrxn);

      if (!cachedActiveAccount || !cached30DaysTrxn) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [getActiveAccount, p30Days] = await Promise.all([
          !cachedActiveAccount
            ? prisma.$queryRaw`SELECT COUNT(DISTINCT "fromAddress") AS "count" FROM "Transactions" WHERE "createdAt" >= ${todayStart}`
            : Promise.resolve([{ count: cachedActiveAccount }]),
          !cached30DaysTrxn
            ? prisma.transactions.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
              })
            : Promise.resolve(cached30DaysTrxn),
        ]);

        if (!cachedActiveAccount) {
          activeAccount = Number((getActiveAccount as any)[0].count);
          await RedisService.setStringWithExpiry(
            REDIS_KEY.ACTIVE_ACCOUNTS_TODAY,
            activeAccount.toString(),
            600,
          );
        }
        if (!cached30DaysTrxn) {
          previous30DaysTrxn = Number(p30Days);
          await RedisService.setStringWithExpiry(
            REDIS_KEY.TRANSACTIONS_30_DAYS,
            previous30DaysTrxn.toString(),
            600,
          );
        }
      }

      if (!transactions.length) throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

      if (data.order === "asc") {
        if (maxId === data.page + data.limit) {
          nextCursorValue = null;
        }
      } else if (data.order === "desc") {
        if (transactionCount === nextCursor || nextCursor === 1) {
          nextCursorValue = null;
        }
      }

      const offset = transactionCount % data.limit || data.limit;
      const lastPage =
        data.order === "asc" ? maxId - offset : minId[minId.length - 1].id;

      return {
        error: false,
        message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
        data: {
          count: transactionCount,
          transactions: convertBigIntToNumber(transactions),
          nextCursor: nextCursorValue,
          prevCursor,
          previous30DaysTrxn,
          activeAccount,
          lastPage,
        },
      };
    } catch (err) {
      console.error("err", err);
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

  ascPagination = async (page: number, limit: number) => {
    const isFirstPage = page === 1;
    const transactions = await prisma.transactions.findMany({
      select: {
        id: true,
        blocknumber: true,
        txhash: true,
        contractAddress: true,
        status: true,
        type: true,
        timestamp: true,
        fromAddress: true,
        toAddress: true,
        txFee: true,
        value: true,
        createdAt: true,
        gasWanted: true,
        gasUsed: true,
      },
      orderBy: {
        id: "asc",
      },
      where: isFirstPage ? {} : { id: { gt: page } },
      take: limit,
    });

    const nextCursor =
      transactions.length === limit
        ? convertBigIntToNumber(transactions)[transactions.length - 1].id
        : null;
    const prevCursor = isFirstPage
      ? null
      : page && transactions.length > 0
        ? convertBigIntToNumber(transactions)[0].id - (limit + 1)
        : null;

    return {
      transactions,
      nextCursor,
      prevCursor: prevCursor === 0 ? 1 : prevCursor,
    };
  };

  /**
   * handle the desc pagination according to id
   * @param page
   * @param limit
   * @returns
   */
  descPagination = async (page: number, limit: number) => {
    const isFirstPage = page === 1;

    const transactions = await prisma.transactions.findMany({
      select: {
        id: true,
        blocknumber: true,
        txhash: true,
        contractAddress: true,
        status: true,
        type: true,
        timestamp: true,
        fromAddress: true,
        toAddress: true,
        gasWanted: true,
        txFee: true,
        value: true,
        createdAt: true,
        gasUsed: true,
      },
      orderBy: {
        id: "desc",
      },
      where: isFirstPage ? {} : { id: { lt: page } },
      take: limit,
    });

    const nextCursor =
      transactions.length === limit
        ? convertBigIntToNumber(transactions)[transactions.length - 1].id
        : null;
    const prevCursor = isFirstPage
      ? null
      : page && transactions.length > 0
        ? convertBigIntToNumber(transactions)[0].id + (limit + 1)
        : null;

    return { transactions, nextCursor, prevCursor };
  };

  /**
   * get transaction details
   * @param address
   * @returns
   */
  async getDvpnTransactionsByAddress(data: {
    page: number;
    limit: number;
    address: string;
  }): Promise<IESResponse> {
    try {
      const [transactions, transactionCount] = await prisma.$transaction([
        prisma.transactions.findMany({
          orderBy: {
            createdAt: "desc",
          },
          where: {
            type: {
              in: MSG_TYPE,
            },
            OR: [
              {
                fromAddress: data.address,
              },
              {
                toAddress: data.address,
              },
            ],
          },

          skip: data.page * data.limit,
          take: data.limit,
        }),
        prisma.transactions.count({
          where: {
            type: {
              in: MSG_TYPE,
            },
            OR: [
              {
                fromAddress: data.address,
              },
              {
                toAddress: data.address,
              },
            ],
          },
        }),
      ]);
      if (!transactions?.length) throw new Error(RES_MSG.NOT_FOUND);

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: transactionCount,
          transactions: convertBigIntToNumber(transactions),
        },
      };
    } catch (err) {
      console.log("error in getTransactionsByAddress : ", err);
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
export default new TransactionService();
