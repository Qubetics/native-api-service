import * as express from "express";
import * as Joi from "joi";
import { RESPONSES } from "../../constant";
import { isOnyNumbers } from "../../Utility/common";

export const getTxByHashValidation = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const schema = Joi.object({
    transactionHash: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        } else if (!value.startsWith("0x")) {
          return helpers.error("custom.validHash");
        } else if (value.length !== 66) {
          return helpers.error("custom.hashLength");
        }
      })

      .messages({
        "custom.validHash": "transaction hash should be start with 0x",
        "custom.hashLength": "transaction hash length should be equals to 66",
        "custom.noLeadingSpaces":
          "transaction hash should not start with a space",
        "string.pattern.base": "transaction hash must start with 0x",
        "string.base": "transaction hash must be a string",
        "any.required": "transaction hash is required",
        "string.empty": "transaction hash cannot be empty",
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
const isNumeric = (str: string) => {
  const pattern = /^-?\d*\.?\d+$/;
  return pattern.test(str);
};
export const getTxByBlock = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const querySchema = Joi.object({
    value: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        if (!isNumeric(value)) {
          if (!value.startsWith("0x")) {
            return helpers.error("custom.invalidHash");
          }
          if (value.startsWith("0x") && !(value.length === 66)) {
            return helpers.error("custom.hashLength");
          }
        } else {
          if (value.includes(".")) {
            return helpers.error("custom.noDecimals");
          }
          if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
            return helpers.error("custom.nonzero");
          }
        }
        return Number(value);
      })
      .messages({
        "custom.noDecimals": "block number should not be in decimal",
        "custom.nonzero": "block number should be greater than 0",
        "custom.noLeadingSpaces": "block number should not start with a space",
        "string.pattern.base": "block hash must start with 0x",
        "string.base": "block hash must be a string",
        "any.required": "block number is required",
        "string.empty": "block cannot be empty",
        "custom.invalidblock": "invalid block number",
        "custom.invalidHash":
          "block hash or transaction hash should be start with 0x",
      }),
    page: Joi.string()

      .required()
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
        "custom.noLeadingSpaces": "page should not start with a space",
        "any.required": "page is required",
        "custom.invalidPage": "invalid page number",
      }),
    limit: Joi.string()
      // .trim()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        const parsedValue = parseFloat(value.trim());
        if (
          isNaN(value) ||
          !Number.isInteger(parsedValue) ||
          parsedValue < 1 ||
          parsedValue > 10
        ) {
          return helpers.error("custom.number");
        }
        return parsedValue;
      }, "Number Validation")
      .messages({
        "custom.number": "limit should be a valid integer between 1 and 10",
        "custom.noLeadingSpaces": "limit should not start with a space",
        "any.required": "limit is required",
      }),
  });

  const queryResult = querySchema.validate(req.query);

  if (queryResult.error) {
    return res.status(400).json({
      error: true,
      message: queryResult.error.details[0].message,
    });
  }

  next();
};

export const transactionSearch = (
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
        "custom.noLeadingSpaces": "page should not start with a space",
        "any.required": "page is required",
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
          parsedValue > 10
        ) {
          return helpers.error("custom.number");
        }
        return parsedValue;
      }, "Number Validation")
      .messages({
        "custom.number": "limit should be a valid integer between 1 and 10",
        "custom.noLeadingSpaces": "limit should not start with a space",
        "any.required": "limit is required",
      }),
    address: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        }
        if (value.length < 42) {
          return helpers.error("custom.hashLength");
        }
      })
      .messages({
        "custom.hashLength": "address length should be equals to 42",
        "custom.noLeadingSpaces": "address should not start with a space",
        "any.required": "address is required",
        "string.empty": "address cannot be empty",
      }),
  });

  const { error, value } = schema.validate(req.query);

  if (error) {
    return res
      .status(RESPONSES.BADREQUEST)
      .json({ error: true, message: error.details[0].message });
  }
  next();
};

export const updateTransactionValidation = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const bodySchema = Joi.object({
    type: Joi.string(),
    status: Joi.string()

      .custom((status, helpers) => {
        if (status) {
          if (status.startsWith(" ")) {
            return helpers.error("custom.noLeadingSpaces");
          } else if (status !== "SUCCESS" && status !== "FAILED") {
            return helpers.error("custom.invalid");
          }
          return status;
        }
      })
      .messages({
        "custom.noLeadingSpaces": "status should not start with a space",
        "custom.invalid":
          'status should be "SUCCESS" or "FAILED"  not other than that.',
      }),
    blocknumber: Joi.string()
      .regex(/^\d+$/)
      .custom((value, helpers) => {
        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue <= 0) {
          return helpers.error("any.invalid");
        }
      })

      .messages({
        "string.pattern.base":
          "block number should be valid number, greater than 0 and not in decimal",
        "any.invalid":
          "block number must be a valid number and greater than zero",
      }),
    fromAddress: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!value) {
          return helpers.error("custom.required");
        } else if (!value.startsWith("qubetics")) {
          return helpers.error("custom.validHash");
        } else if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        } else if (value.length < 42) {
          return helpers.error("custom.hashLength");
        }
      })
      .messages({
        "custom.required": "from address is required",
        "custom.noLeadingSpaces": "address should not start with a space",
        "custom.validHash": "from address should start with qubetics",
        "custom.hashLength":
          "from address length should be equals to or greater than 42",
        "string.base": "from address must be a string",
      }),
    toAddress: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (!value) {
          return helpers.error("custom.required");
        } else if (!value.startsWith("qubetics")) {
          return helpers.error("custom.validHash");
        } else if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        } else if (value.length < 42) {
          return helpers.error("custom.hashLength");
        }
      })
      .messages({
        "custom.required": "to address is required",
        "custom.noLeadingSpaces": "address should not start with a space",
        "custom.validHash": "to address should start with qubetics",
        "custom.hashLength":
          "to address length should be equals to or greater than 42",
        "string.base": "to address must be a string",
      }),

    gasWanted: Joi.number().positive().integer().strict().required().messages({
      "number.base": "gasWanted must be a number",
      "number.positive":
        "gasWanted must be a greater than 0 and positive number",
      "number.integer": "gasWanted must not be in decimal",
      "any.required": "gasWanted is required",
    }),
    txFee: Joi.number().positive().integer().strict().required().messages({
      "number.base": "txFee must be a number",
      "number.positive": "txFee must be a greater than 0 and positive number",
      "number.integer": "txFee must not be in decimal",
      "any.required": "txFee is required",
    }),
    value: Joi.string()
      .custom((value, helpers) => {
        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue < 0) {
          return helpers.error("custom.invalid");
        }
        return value;
      })
      .messages({
        "custom.invalid": "value must be a positive",
      }),
  });

  const paramSchema = Joi.object({
    transactionHash: Joi.string()
      .required()
      .custom((value, helpers) => {
        if (value.startsWith(" ")) {
          return helpers.error("custom.noLeadingSpaces");
        } else if (!value.startsWith("0x")) {
          return helpers.error("custom.validHash");
        } else if (value.length !== 66) {
          return helpers.error("custom.hashLength");
        }
      })
      .messages({
        "custom.validHash": "transaction hash should start with 0x",
        "custom.hashLength": "transaction hash length should be equals to 66",
        "custom.noLeadingSpaces":
          "transaction hash should not start with a space",
        "string.pattern.base": "transaction hash must start with 0x",
        "string.base": "transaction hash must be a string",
        "string.empty": "transaction hash cannot be empty",
      }),
  });

  const { error: bodyError, value: bodyValue } = bodySchema.validate(req.body);
  if (bodyError) {
    return res
      .status(400)
      .json({ error: true, message: bodyError.details[0].message });
  }

  const { error: paramsError, value: paramsValue } = paramSchema.validate(
    req.params,
  );

  if (paramsError) {
    return res
      .status(400)
      .json({ error: true, message: paramsError.details[0].message });
  }

  next();
};

export const getTransactionsValidation = (
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
        "custom.noLeadingSpaces": "page should not start with a space",
        "any.required": "page is required",
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
        "any.required": "limit is required",
      }),
    order: Joi.string()
      .optional()
      .custom((value, helpers) => {
        console.log(value !== "dsec" || value !== "asc");

        if (value === "desc" || value === "asc") {
          return value;
        }
        return helpers.error("custom.order");
      })
      .messages({
        "custom.order": "Order must be dsec or asc.",
      }),
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return res
      .status(400)
      .json({ error: true, message: error.details[0].message });
  }
  next();
};
