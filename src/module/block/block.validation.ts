import * as express from "express";
import * as Joi from "joi";
import { isOnyNumbers } from "../../Utility/common";

// const isNumeric = (str: string) => {
// 	const pattern = /^-?\d*\.?\d+$/;
// 	return pattern.test(str);
// };

export const getBlocksValidation = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const schema = Joi.object({
    page: Joi.string()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        const parsedValue = parseFloat(value.trim());

        if (
          isNaN(value) ||
          !Number.isInteger(parsedValue) ||
          parsedValue < 1 ||
          value.toString().length >= 19
        ) {
          return helpers.error("custom.invalidPage");
        }
        return parsedValue;
      }, "Number Validation")
      .messages({
        "custom.noLeadingSpaces": "cur should not start with a space",
        "custom.invalidPage": "invalid page number",
      }),
    limit: Joi.string()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        const parsedValue = parseFloat(value.trim());
        if (
          isNaN(value) ||
          !Number.isInteger(parsedValue) ||
          parsedValue < 1 ||
          parsedValue > 200
        ) {
          return helpers.error("custom.number");
        }
        return parsedValue;
      }, "Number Validation")
      .messages({
        "custom.number": "limit should be a valid integer between 1 and 200",
        "custom.noLeadingSpaces": "limit should not start with a space",
      }),
    order: Joi.string()
      .optional()
      .custom((value, helpers) => {
        console.log(value !== "desc" || value !== "asc");

        if (value === "desc" || value === "asc") {
          return value;
        } else if (value === "undefined") {
          return "desc";
        }
        return helpers.error("custom.order");
      })
      .messages({
        "custom.order": "Order must be desc or asc.",
      }),
    filterBy: Joi.string()
      .optional()
      .custom((value, helpers) => {
        console.log(value !== "newest" || value !== "oldest");

        if (value === "newest" || value === "oldest") {
          return value;
        } else if (value !== "newest" && value !== "oldest") {
          return "newest";
        }
        return helpers.error("custom.order");
      })
      .messages({
        "custom.order": "Filter must be newest or oldest.",
      }),
  });

  const { error, value } = schema.validate(req.query);

  if (error) {
    return res
      .status(400)
      .json({ error: true, message: error.details[0].message });
  }
  next();
};
export const getBlockByHashValidation = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const schema = Joi.object({
    blockHash: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        if (value.length !== 64) {
          return helpers.error("custom.hashLength");
        }
      })
      .messages({
        "custom.hashLength": "block hash length should be equals to 66",
        "custom.noLeadingSpaces": "block hash should not start with a space",
        "any.required": "block hash is required",
        "string.empty": "block cannot be empty",
      }),
  });
  const { error, value } = schema.validate(req.params);
  if (error) {
    return res
      .status(400)
      .json({ error: true, message: error.details[0].message });
  }
  next();
};

export const getBlockDetailsValidation = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const paramsSchema = Joi.object({
    blockIdentity: Joi.string()
      .required()
      .custom((block, helpers) => {
        block = block.trim();

        if (block.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        if (!isOnyNumbers(block)) {
          if (!block.startsWith("0x")) {
            return helpers.error("custom.validHash");
          }
          if (block.length !== 66) {
            return helpers.error("custom.hashLength");
          }
        } else {
          if (block?.length >= 19) {
            return helpers.error("custom.invalidblock");
          }
          if (block.includes(".")) {
            return helpers.error("custom.noDecimals");
          }
          if (Number(block) < 0) {
            return helpers.error("custom.nonzero");
          }
        }
        return parseFloat(block.trim());
      })
      .messages({
        "custom.noDecimals": "block number should not be in decimal",
        "custom.nonzero": "block number should be greater than or equal to 0",
        "custom.validHash": "block hash should be start with 0x",
        "custom.hashLength": "block hash must be 66 characters.",
        "custom.noLeadingSpaces": "block hash should not start with a space",
        "string.pattern.base": "block hash must start with 0x",
        "string.base": "block hash must be a string",
        "any.required": "block hash/number is required",
        "string.empty": "block cannot be empty",
        "custom.invalidblock": "invalid block number",
      }),
  });
  const paramsResult = paramsSchema.validate(req.params);

  if (paramsResult.error) {
    return res.status(400).json({
      error: true,
      message: paramsResult.error.details[0].message,
    });
  }
  next();
};
