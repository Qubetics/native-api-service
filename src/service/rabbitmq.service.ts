import * as amqp from "amqplib/callback_api";
import { log } from "../Utility/common";
import { COLORS, QUEUE_NAME } from "../constant";
import logger from "../lib/logger";

class RabbitMq {
  public channel: amqp.Channel;

  constructor() {
    this.startServer();
  }

  public async startServer() {
    try {
      const res = await this.connect();
      this.channel = res;
      Object.values(QUEUE_NAME).forEach((queue) => {
        this.channel.assertQueue(queue, {
          durable: false,
        });
      });
      return true;
    } catch (error) {
      logger.error("Error while connecting to RabbitMQ: ", error);
      return false;
    }
  }

  public connect(): Promise<amqp.Channel> {
    return new Promise((resolve, reject) => {
      amqp.connect(environment.rabbitMq, (err, conn) => {
        if (err) {
          logger.error("the rabbit error", err);
          reject(err);
          return;
        }

        conn?.createChannel((error: Error, ch) => {
          if (error) {
            logger.error("the error is ", error);
            reject(error);
            return;
          }

          log("RabbiMQ connected ", COLORS.yellow, true, COLORS.green);
          resolve(ch);
        });
      });
    });
  }

  public assertQueue(queue: string) {
    this.channel?.assertQueue(queue, { durable: false });
  }

  public inQueueData(queue: string, data: string) {
    try {
      this.channel?.sendToQueue(queue, Buffer.from(data));
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new RabbitMq();
