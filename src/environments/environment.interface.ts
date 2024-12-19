interface IEnvironment {
	port: number;
	address_prefix: string;
	databaseUrl: string;
	httpHost: string;
	redisHost: string;
	redisPort: string;
	rabbitMq: string;
	evmHost: string;
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