import prisma from "../../lib/db";
import { ICreateTransaction, IESResponse } from "../../interfaces";
import { REDIS_KEY, RES_MSG } from "../../constant";
import { convertBigIntToNumber } from "../../helper/common.helper";
import { RedisService } from "../../service";

class TransactionService {
  /**
   * get all transaction
   * @param data
   * @returns
   */
  async getAllTransactions(data: {
    page?: number;
    limit: number;
  }): Promise<IESResponse> {
    try {
      const isFirstPage = data.page === 1;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [transactions, previous30DaysTrxn, getAccountCount] =
        await prisma.$transaction([
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
          prisma.$queryRaw`
          SELECT COUNT(DISTINCT "fromAddress") AS "count" FROM "Transactions" WHERE "timestamp" >= ${todayStart.toISOString()}::timestamp AND "timestamp" <= ${new Date().toISOString()}::timestamp`,
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

      const activeAccount: any = convertBigIntToNumber(getAccountCount);

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          count: transactionCount,
          transactions: convertBigIntToNumber(transactions),
          nextCursor,
          prevCursor,
          previous30DaysTrxn,
          activeAccount: activeAccount ? activeAccount[0].count : 0,
        },
      };
    } catch (err) {
      console.log("error in get all transactions : ", err);

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
        const block = await prisma.blocks.findUnique({
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
}
export default new TransactionService();
