import * as express from 'express';
import * as Joi from 'joi';
import { RESPONSES } from '../../constant';
import { isOnyNumbers } from '../../Utility/common';

export const getValidatorsValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			// .required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());

				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					value.toString().length >= 19
				) {
					return helpers.error('custom.invalidPage');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'any.required': 'page is required',
				'custom.invalidPage': 'invalid page number',
			}),
		limit: Joi.string()
			// .required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					parsedValue > 10
				) {
					return helpers.error('custom.number');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 10',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
		status: Joi.string()
			.custom((status, helpers) => {
				if (status) {
					if (status.startsWith(' ')) {
						return helpers.error('custom.noLeadingSpaces');
					} else if (
						status !== 'active' &&
						status !== 'inactive' &&
						status !== 'deactivating'
					) {
						return helpers.error('custom.invalid');
					}
					return status;
				}
			})
			.messages({
				'custom.noLeadingSpaces':
					'status should not start with a space',
				'custom.invalid':
					'status should be "active" , "inactive" or "deactivating" not other than that.',
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

export const validatorSearch = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());

				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					value.toString().length >= 19
				) {
					return helpers.error('custom.invalidPage');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'any.required': 'page is required',
				'custom.invalidPage': 'invalid page number',
			}),
		limit: Joi.string()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				const parsedValue = parseFloat(value.trim());
				if (
					isNaN(value) ||
					!Number.isInteger(parsedValue) ||
					parsedValue < 1 ||
					parsedValue > 10
				) {
					return helpers.error('custom.number');
				}
				return parsedValue;
			}, 'Number Validation')
			.messages({
				'custom.number':
					'limit should be a valid integer between 1 and 10',
				'custom.noLeadingSpaces': 'limit should not start with a space',
				'any.required': 'limit is required',
			}),
		value: Joi.string()
			.required()
			.custom((validator, helpers) => {
				if (validator.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				// if (!isOnyNumbers(validator)) {

				// 	if (!validator.startsWith('0x')) {
				// 		return helpers.error('custom.validHash');
				// 	}
				// 	if (validator.length !== 44) {
				// 		return helpers.error('custom.hashLength');
				// 	}
				// } else {
				// 	if (validator?.length >= 19) {
				// 		return helpers.error('custom.invalidblock');
				// 	}
				// 	if (validator.includes('.')) {
				// 		return helpers.error('custom.noDecimals');
				// 	}
				// 	if (Number(validator) < 0) {
				// 		return helpers.error('custom.nonzero');
				// 	}
				// }
			})
			.messages({
				'custom.noLeadingSpaces': 'page should not start with a space',
				'custom.nonzero':
					'block number should be greater than or equal to 0',
				'custom.validHash': 'validator address should be start with 0x',
				'custom.hashLength': 'validator address must be 44 characters.',
				'string.pattern.base': 'block hash must start with 0x',
				'string.base': 'validator address must be a string',
				'any.required': 'validator name or address is required',
				'string.empty': 'value cannot be empty',
				'custom.invalidblock': 'invalid block number',
			}),
		address: Joi.string(),
	});

	const { error, value } = schema.validate(req.query);

	if (error) {
		return res
			.status(RESPONSES.BADREQUEST)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getDetailsValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		address: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (value.length !== 44) {
					return helpers.error('custom.hashLength');
				}
			})
			.messages({
				'custom.hashLength': 'address length should be equals to 44',
				'custom.noLeadingSpaces':
					'address should not start with a space',
				'any.required': 'address is required',
				'string.empty': 'address cannot be empty',
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
