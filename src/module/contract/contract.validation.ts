import * as Joi from 'joi';
import * as express from 'express';

export const getContractValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			// .trim()
			.required()
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
			// .trim()
			.required()
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
	});

	const { error, value } = schema.validate(req.query);
	if (error) {
		return res
			.status(400)
			.json({ error: true, message: error.details[0].message });
	}
	next();
};

export const getContractByAddressValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		contractAddress: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (!value.startsWith('qubetics')) {
					return helpers.error('custom.validHash');
				}
				if (!(value.length === 64)) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash':
					'contract address should be start with qubetics',
				'custom.hashLength':
					'contract address length should be equals to 64',
				'custom.noLeadingSpaces':
					'contract address should not start with a space',
				'string.pattern.base': 'contract address must start with qubetics',
				'string.base': 'contract address must be a string',
				'any.required': 'contract address is required',
				'string.empty': 'contract address cannot be empty',
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

export const getContractTxValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		page: Joi.string()
			// .trim()
			.required()
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
			// .trim()
			.required()
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
		contractAddress: Joi.string()
			.required()
			.custom((value, helpers) => {
				if (value.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
				if (!value.startsWith('qubetics')) {
					return helpers.error('custom.validHash');
				}
				if (!(value.length === 64)) {
					return helpers.error('custom.hashLength');
				}
			})

			.messages({
				'custom.validHash':
					'contract address should be start with qubetics',
				'custom.hashLength':
					'contract address length should be equals to 64',
				'custom.noLeadingSpaces':
					'contract address should not start with a space',
				'string.pattern.base': 'contract address must start with qubetics',
				'string.base': 'contract address must be a string',
				'any.required': 'contract address is required',
				'string.empty': 'contract address cannot be empty',
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
