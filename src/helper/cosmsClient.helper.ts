import { fromBase64, toHex } from "@cosmjss/encoding";
import { anyToSinglePubkey } from "@cosmjss/proto-signing";
import { QueryClient, setupStakingExtension } from "@cosmjss/stargate";
import { pubkeyToAddress, Tendermint37Client } from "@cosmjss/tendermint-rpc";
import { assert } from "@cosmjss/utils";
import { bech32 } from "bech32";

export class CosmJsRpcMethods {
  private rpcUrl = environment.httpHost;

  private static instance: CosmJsRpcMethods;

  private tendermintClient: Tendermint37Client;

  private prefix = environment.address_prefix;

  private constructor() {
    this.createCosmosClient();
  }

  public static getInstance(): CosmJsRpcMethods {
    if (!CosmJsRpcMethods.instance) {
      CosmJsRpcMethods.instance = new CosmJsRpcMethods();
    }
    return CosmJsRpcMethods.instance;
  }

  public async createCosmosClient() {
    try {
      this.tendermintClient = await Tendermint37Client.connect(this.rpcUrl);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async tendermintValAddressToValoperAddress(value: string) {
    try {
      const queryClient = QueryClient.withExtensions(
        this.tendermintClient,
        setupStakingExtension,
      );
      const tendermintToOperator = new Map<string, string>();
      let nextKey: Uint8Array | undefined;
      do {
        const res = await queryClient.staking.validators(
          "BOND_STATUS_BONDED",
          nextKey,
        );
        res.validators.forEach((r) => {
          assert(r.consensusPubkey);
          const pubkey = anyToSinglePubkey(r.consensusPubkey);
          const address = pubkeyToAddress("ed25519", fromBase64(pubkey.value));
          tendermintToOperator.set(address, r.operatorAddress);
        });
        nextKey = res.pagination?.nextKey;
      } while (nextKey?.length);
      const valoperAddress: string = <string>tendermintToOperator.get(value);
      return valoperAddress;
    } catch (err) {
      console.log("error while tendermintValAddressToValoperAddress  : ", err);
      return "";
    }
  }

  public async getDelegatorAddress(operatorAddr: string) {
    try {
      const address = bech32.decode(operatorAddr);
      const delegatorAddress = bech32.encode(this.prefix, address.words);
      return delegatorAddress;
    } catch (err) {
      console.log("error while getDelegatorAddress  : ", err);
      return "";
    }
  }
}
