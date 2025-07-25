import * as express from "express";
import * as Joi from "joi";
export const getTransactionHashValidation = (
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
                "custom.hashLength": "txHash hash length should be equals to 66",
                "custom.noLeadingSpaces": "txHash hash should not start with a space",
                "any.required": "txHash hash is required",
                "string.empty": "txHash cannot be empty",
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