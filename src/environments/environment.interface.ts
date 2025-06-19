interface IEnvironment {
  port: number;
  address_prefix: string;
  secretKey: string;
  applyEncryption: boolean;
  databaseUrl: string;
  httpHost: string;
  saltValue: number;
  redisHost: string;
  redisPort: string;
  rabbitMq: string;
  publicKey: string;
  privateKey: string;
  recaptchaSiteKey: string;
  recaptchaUrl: string;
  coinMarketApi: string;
  coinMarketKey: string;
  currency: string;
  symbol: string;
  evmHost: string;
  nodeIp: string;
  redisExpiry: number;
  validators: string;
  excludedValidators: string;
  getCurrentEnvironment(): string;
  setEnvironment(env: string): void;
  isProductionEnvironment(): boolean;
  isDevEnvironment(): boolean;
  isTestEnvironment(): boolean;
  isStagingEnvironment(): boolean;
}

export default IEnvironment;
