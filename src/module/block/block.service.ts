import prisma from "../../lib/db";
import { RabbitMqService, RedisService } from "../../service/index";
import { fetchRequest, isOnyNumbers } from "../../Utility/common";
import { IBlock, IESResponse } from "../../interfaces/index";
import { convertBigIntToNumber } from "../../helper/common.helper";
import { RES_MSG, QUEUE_NAME, REDIS_KEY } from "../../constant";
import { CosmJsRpcMethods } from "../../helper/cosmsClient.helper";
import { cursorPagination, serializeBigInt } from "../../lib/utilities.helper";

class BlockService {
  cosmjsInstace: CosmJsRpcMethods;

  constructor() {
    this.cosmjsInstace = CosmJsRpcMethods.getInstance();
  }
  /**
   * get all blocks
   * @param data
   * @returns
   */
  async getAllLatestBlock_1(data: {
    page?: number;
    limit: number;
  }): Promise<IESResponse> {
    try {
      const isFirstPage = data.page === 1;
      const blocks = await prisma.blocks.findMany({
        orderBy: {
          blocknumber: "desc",
        },
        where: isFirstPage ? {} : { blocknumber: { lt: data.page } },
        take: data.limit,
      });

      const blockCount = await RedisService.getString(
        REDIS_KEY.NATIVE_BLOCKS_COUNT,
      );

      if (!blocks?.length) throw new Error(RES_MSG.NOT_FOUND);
      const nextCursor =
        blocks.length === data.limit
          ? convertBigIntToNumber(blocks)[blocks.length - 1].blocknumber
          : null;
      const prevCursor = isFirstPage
        ? null
        : data.page && blocks.length > 0
          ? convertBigIntToNumber(blocks)[0].blocknumber + 11
          : null;

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          blockCount,
          blocks: convertBigIntToNumber(blocks),
          nextCursor,
          prevCursor,
        },
      };
    } catch (err) {
      console.log("error while getting all blocks : ", err);
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
   * get blocks by block hash
   * @param hash
   * @returns
   */
  async getBlockByHash(hash: string): Promise<IESResponse> {
    try {
      let blockDetailsByHash = await prisma.blocks.findUnique({
        where: {
          blockhash: hash,
        },
      });

      if (!blockDetailsByHash) {
        const url = `${environment.httpHost}/block_by_hash?hash=${hash}`;
        const fetchRes = await fetchRequest(url, "GET", null);

        if (fetchRes?.error || !fetchRes?.data?.result?.block) {
          throw new Error(RES_MSG.NOT_FOUND);
        }
        const validatorOperatorAddress =
          <string>(
            await this.cosmjsInstace.tendermintValAddressToValoperAddress(
              fetchRes?.data.result.block?.header?.proposer_address,
            )
          ) || "";

        const miner =
          <string>(
            await this.cosmjsInstace.getDelegatorAddress(
              validatorOperatorAddress,
            )
          ) || "";

        const blockData: IBlock = {
          miner,
          validatorOperatorAddress,
          blocknumber: fetchRes?.data.result.block?.header?.height,
          blockhash: hash,
          timestamp: fetchRes?.data.result?.block?.header?.time || "",
          transactionCount: fetchRes.data.result?.block?.data?.txs?.length,
        };

        RabbitMqService.inQueueData(
          QUEUE_NAME.MISSED_BLOCK,
          JSON.stringify(blockData),
        );
        return {
          error: false,
          message: RES_MSG.FETCH_SUCCESS,
          data: {
            block: convertBigIntToNumber([blockData])[0],
          },
        };
      }
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          block: convertBigIntToNumber([blockDetailsByHash])[0],
        },
      };
    } catch (err) {
      console.log("error in getBlockByHash : ", err);
      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  /**
   * get block details by block number
   * @param blockNumber
   * @returns
   */
  async getBlockByNumber(blockNumber: number): Promise<IESResponse> {
    try {
      let blockDetail: any = await prisma.blocks.findUnique({
        where: {
          blocknumber: blockNumber,
        },
      });

      if (!blockDetail) {
        const url = `${environment.httpHost}/block?height=${blockNumber}`;
        const fetchRes = await fetchRequest(url, "GET", null);

        if (fetchRes.error) {
          throw new Error(RES_MSG.NOT_FOUND);
        }

        const validatorOperatorAddress: string =
          <string>(
            await this.cosmjsInstace.tendermintValAddressToValoperAddress(
              fetchRes?.data.result.block?.header?.proposer_address,
            )
          ) || "";

        const miner =
          <string>(
            await this.cosmjsInstace.getDelegatorAddress(
              validatorOperatorAddress,
            )
          ) || "";

        const blockHash = fetchRes?.data?.result?.block_id?.hash;
        const dataToSave: IBlock = {
          miner,
          validatorOperatorAddress,
          blocknumber: Number(blockNumber),
          blockhash: blockHash
            ? `0x${fetchRes?.data?.result?.block_id?.hash}`
            : "",
          timestamp: fetchRes?.data.result.block?.header?.time || "",
          transactionCount: fetchRes?.data.result.block?.data?.txs?.length || 0,
        };
        RabbitMqService.inQueueData(
          QUEUE_NAME.MISSED_BLOCK,
          JSON.stringify(dataToSave),
        );
        return {
          error: false,
          message: RES_MSG.FETCH_SUCCESS,
          data: convertBigIntToNumber([dataToSave])[0],
        };
      }

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: { block: convertBigIntToNumber([blockDetail])[0] },
      };
    } catch (err) {
      console.log("error in getBlockByNumber :   ", err);

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
   * get block details by block number or block hash
   * @param blockIdentity
   * @returns
   */
  async getBlockDetails(blockIdentity: string): Promise<IESResponse> {
    try {
      const onlyNumDigits = isOnyNumbers(blockIdentity);
      let blockDetail;
      if (!onlyNumDigits) {
        blockDetail = await this.getBlockByHash(blockIdentity);
      } else {
        blockDetail = await this.getBlockByNumber(Number(blockIdentity));
      }

      return blockDetail;
    } catch (err) {
      console.log("error in getBlockDetails : ", err);

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
   * latest block
   * @returns
   */
  async getLatestBlock(): Promise<IESResponse> {
    try {
      const blockRes = await fetchRequest(
        `${environment.httpHost}/block`,
        "GET",
        null,
      );
      if (blockRes.error) {
        throw new Error(RES_MSG.ERROR_FETCH_LATEST_BLOCK);
      }

      const validatorOperatorAddress: string =
        <string>(
          await this.cosmjsInstace.tendermintValAddressToValoperAddress(
            blockRes?.data.result.block?.header?.proposer_address,
          )
        ) || "";
      const miner =
        <string>(
          await this.cosmjsInstace.getDelegatorAddress(validatorOperatorAddress)
        ) || "";

      const bHash = blockRes?.data?.result?.block_id?.hash;
      const dataToSend: IBlock = {
        miner,
        validatorOperatorAddress,
        blockhash: bHash ? `0x${bHash}` : "",
        timestamp: blockRes?.data.result.block?.header?.time || "",
        transactionCount: blockRes?.data.result.block?.data?.txs?.length || 0,
        blocknumber: Number(blockRes?.data?.result?.block?.header?.height),
      };
      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: dataToSend,
      };
    } catch (err) {
      console.log("error in getLatestBlock : ", err);
      if (err instanceof Error) {
        return { error: true, message: err.message };
      }
      return { error: true, message: RES_MSG.ERROR };
    }
  }

  async getAllLatestBlock(data: {
    page: number;
    limit: number;
    order: any;
    filterBy: string;
  }): Promise<IESResponse> {
    try {
      const isFirstPage = data.page === 1;

      // Fetch main data and metadata in parallel
      const [blocks, cachedBlockCount, cachedMinMax] = await Promise.all([
        prisma.blocks.findMany({
          orderBy: { blocknumber: data.order },
          where: isFirstPage
            ? {}
            : {
                blocknumber: data.order === "asc" ? { gt: data.page } : { lt: data.page },
              },
          take: data.limit,
        }),
        RedisService.getString(REDIS_KEY.NATIVE_BLOCKS_COUNT),
        RedisService.getString("BLOCK_MIN_MAX"),
      ]);

      if (!blocks?.length) throw new Error(RES_MSG.ERROR_FETCH_LATEST_BLOCK);

      let blockCount = Number(cachedBlockCount);
      if (!cachedBlockCount) {
        const result = await prisma.blocks.count();
        blockCount = result;
        await RedisService.setStringWithExpiry(REDIS_KEY.NATIVE_BLOCKS_COUNT, blockCount.toString(), 300);
      }

      let minMaxData = cachedMinMax ? JSON.parse(cachedMinMax) : null;
      if (!minMaxData) {
        const blockCountData = await prisma.blocks.aggregate({
          _min: { blocknumber: true },
          _max: { blocknumber: true },
        });
        minMaxData = {
          minimumId: Number(blockCountData?._min.blocknumber),
          maximumId: Number(blockCountData?._max.blocknumber),
        };
        await RedisService.setStringWithExpiry("BLOCK_MIN_MAX", JSON.stringify(minMaxData), 600);
      }

      const { minimumId, maximumId } = minMaxData;

      // Use caching for lastPageResult too if possible, or only fetch when needed
      // Actually, lastPage is based on blockCount and min/max. Let's see if we can optimize it.
      const lastPageCacheKey = `BLOCK_LAST_PAGE_${data.filterBy || 'newest'}_${data.order}`;
      let lastPage = await RedisService.getString(lastPageCacheKey);

      if (lastPage === null) {
        const lastPageResult = await prisma.blocks.findMany({
          select: { blocknumber: true },
          orderBy: {
            blocknumber: data.filterBy === "newest" || !data.filterBy ? "asc" : "desc",
          },
          where: {
            blocknumber: data.filterBy === "newest" || !data.filterBy ? { gt: minimumId } : { lt: maximumId },
          },
          take: blockCount % data.limit || data.limit,
        });
        if (lastPageResult.length > 0) {
          lastPage = serializeBigInt(lastPageResult[lastPageResult.length - 1].blocknumber);
          await RedisService.setStringWithExpiry(lastPageCacheKey, lastPage.toString(), 300);
        } else {
          lastPage = 0;
        }
      }

      const cursorPages = cursorPagination(
        blocks,
        data.order,
        data.filterBy,
        data.limit,
        "blocknumber",
        blockCount,
        maximumId,
        minimumId,
      );

      return {
        error: false,
        message: RES_MSG.FETCH_SUCCESS,
        data: {
          blockCount,
          blocks: convertBigIntToNumber(blocks),
          nextCursor: cursorPages.nextCursor,
          prevCursor: cursorPages.previousCursor,
          lastPage: Number(lastPage),
        },
      };
    } catch (err) {
      console.log("error while getting all blocks : ", err);
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

export default new BlockService();
