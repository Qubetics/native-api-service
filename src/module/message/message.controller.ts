import * as express from "express";
import MessageService from './message.service';
import { Request, Response } from "express";
import * as Helpers from "../../service/index";
import { Controller } from "../../interfaces/index";
import { getTransactionHashValidation } from "./message.validation";
import { request } from "http";

const setResponse = Helpers.ResponseHelper;

class MessageController implements Controller {
    public router = express.Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router
            .get("/all-message", this.getAllMessage)
            .get('/up-timehistory', this.getUpTimeHistory)
    }

    private getAllMessage = async (request: Request, response: Response) => {
        const data = {
            txHash: String(request.query.txHash),
        };
        const sessions = await MessageService.getAllMessage(data);
        if (sessions.error) {
            return setResponse.error(response, sessions);
        }
        return setResponse.success(response, sessions);
    }

    private getUpTimeHistory = async (request: Request, response: Response) => {
        const data = {
            nodeAddress: String(request.query.nodeAddress),
            duration: String(request.query.duration)
        };

        const nodeUpTimeHistory = await MessageService.getUpTimeHistory(data);
        if (nodeUpTimeHistory.error) {
            return setResponse.error(response, nodeUpTimeHistory);
        }
        return setResponse.success(response, nodeUpTimeHistory);
    }

}
export default MessageController;
