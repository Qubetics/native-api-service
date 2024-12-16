import * as express from 'express';
import BlockService from './block.service';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import { Controller } from '../../interfaces/index';
import {
	getBlockDetailsValidation,
	getBlocksValidation,
} from './block.validation';

const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get('', getBlocksValidation, this.getAllBlock)
			.get(
				'/detail/:blockIdentity',
				getBlockDetailsValidation,
				this.getBlockDetails,
			)
			.get('/latest', this.getLatestBlock);
	}

	private getAllBlock = async (request: Request, response: Response) => {
		const data = {
			page: request.query?.page ? Number(request.query?.page) : 1,

			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
		};

		const res = await BlockService.getAllLatestBlock(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};
	private getBlockDetails = async (request: Request, response: Response) => {
		const blockDetails = await BlockService.getBlockDetails(
			request.params?.blockIdentity as string,
		);
		if (blockDetails.error) {
			return setResponse.error(response, blockDetails);
		}
		return setResponse.success(response, blockDetails);
	};

	private getLatestBlock = async (_request: Request, response: Response) => {
		const blocks = await BlockService.getLatestBlock();

		if (blocks.error) {
			return setResponse.error(response, blocks);
		}

		return setResponse.success(response, blocks);
	};
}

export default ExplorerController;
