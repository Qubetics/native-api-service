import * as express from 'express';
import * as Joi from 'joi';
import { RESPONSES } from '../../constant';

export const getProposalsValidation = (
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
						status !== 'voting' &&
						status !== 'deposit' &&
						status !== 'passed' &&
						status !== 'failed' &&
						status !== 'rejected'
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
					'status should be "voting" , "deposit", "passed", "failed" and "rejected" not other than that.',
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
				if (value.length !== 47) {
					return helpers.error('custom.hashLength');
				}
			})
			.messages({
				'custom.hashLength': 'address length should be equals to 47',
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

export const getVotersValidation = (
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
		proposalId: Joi.string()
			.required()
			.custom((val, helpers) => {
				if (val.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
			})
			.messages({
				'custom.noLeadingSpaces':
					'proposalId should not start with space',
				'any.required': 'proposalId is required',
			}),
		answer: Joi.string()
			.custom((answer, helpers) => {
				if (answer) {
					if (answer.startsWith(' ')) {
						return helpers.error('custom.noLeadingSpaces');
					} else if (
						answer !== 'yes' &&
						answer !== 'no' &&
						answer !== 'veto' &&
						answer !== 'abstain'
					) {
						return helpers.error('custom.invalid');
					}
					return answer;
				}
			})
			.messages({
				'custom.noLeadingSpaces':
					'answer should not start with a space',
				'custom.invalid':
					'answer should be "yes" , "no", "veto" or "abstain" not other than that.',
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

export const voterSearchingValidation = (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	const schema = Joi.object({
		address: Joi.string()
			// .required()
			.custom((val, helpers) => {
				if (val.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
			})
			.messages({
				'custom.noLeadingSpaces': 'address should not start with space',
				'any.required': 'address is required',
			}),

		proposalId: Joi.string()
			.required()
			.custom((val, helpers) => {
				if (val.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
			})
			.messages({
				'custom.noLeadingSpaces':
					'proposalId should not start with space',
				'any.required': 'proposalId is required',
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

export const proposalSearchValidation = (
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
		value: Joi.string()
			.required()
			.custom((validator, helpers) => {
				if (validator.startsWith(' ')) {
					return helpers.error('custom.noLeadingSpaces');
				}
			})
			.messages({
				'custom.noLeadingSpaces': 'value should not start with a space',

				'string.base': 'value must be a string',
				'any.required': 'value is required',
				'string.empty': 'value cannot be empty',
			}),
		status: Joi.string()

			.custom((status, helpers) => {
				if (status) {
					if (status.startsWith(' ')) {
						return helpers.error('custom.noLeadingSpaces');
					} else if (
						status !== 'voting' &&
						status !== 'deposit' &&
						status !== 'passed' &&
						status !== 'failed' &&
						status !== 'rejected'
					) {
						return helpers.error('custom.invalid');
					}
					return status;
				}
			})
			.messages({
				'custom.noLeadingSpaces':
					'status should not start with a space',
				'string.base': 'status must be a string',
				'string.empty': 'status cannot be empty',
				'custom.invalid':
					'status should be "voting" , "deposit", "passed", "failed" and "rejected" not other than that.',
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
