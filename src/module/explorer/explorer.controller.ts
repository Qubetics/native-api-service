import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import ExplorerService from './explorer.service';
import { Controller } from '../../interfaces/index';
import {
	getAddressDetailValidation,
	getGraphHistoryValidation,
	getTpsHistoryValidation,
	searchingValidation,
} from './explorer.validation';

const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	// Define routes and their corresponding handlers
	private initializeRoutes() {
		this.router
			.get('/dashboard', this.dashboard)
			.get('/searching', searchingValidation, this.searching)
			.get(
				'/graph/contract-deployed',
				getGraphHistoryValidation,
				this.getContractDeployedCount,
			)
			.get('/graph/tps', getTpsHistoryValidation, this.getTpsHistory)
			.get(
				'/graph/account',
				getGraphHistoryValidation,
				this.getAccountCounts,
			)
			.get(
				'/address-detail/:address',
				getAddressDetailValidation,
				this.getAddressDetail,
			);
	}

	private dashboard = async (request: Request, response: Response) => {
		const dashboard = await ExplorerService.dashboard();

		if (dashboard.error) {
			return setResponse.error(response, dashboard);
		}
		return setResponse.success(response, dashboard);
	};

	private searching = async (request: Request, response: Response) => {
		const serachingRes = await ExplorerService.searching(
			request.query.value as string,
		);

		if (serachingRes.error) {
			return setResponse.error(response, serachingRes);
		}
		return setResponse.success(response, serachingRes);
	};

	private getAccountCounts = async (request: Request, response: Response) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};
		const res = await ExplorerService.getAccountCounts(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getContractDeployedCount = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time ? 'd' : <string>request.query.time,
		};
		const res = await ExplorerService.getContractDeployedCount(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getAddressDetail = async (request: Request, response: Response) => {
		const res = await ExplorerService.getAddressDetail(
			request.params.address,
		);
		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getTpsHistory = async (request: Request, response: Response) => {
		const data = {
			interval: !request.query?.interval
				? 1
				: Number(request.query.interval),
			time: !request.query?.time
				? 'd'
				: decodeURIComponent(<string>request.query.time),
		};

		const tpsHistoryRes = await ExplorerService.tpsHistory(data);

		if (tpsHistoryRes.error) {
			return setResponse.error(response, tpsHistoryRes);
		}
		return setResponse.success(response, tpsHistoryRes);
	};
}

export default ExplorerController;
