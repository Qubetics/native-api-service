import * as express from 'express';
import * as Joi from 'joi';

export const delegatorByAddressValidation = (
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
				'any.required': 'delegator address is required',
				'string.empty': 'delegator address cannot be empty',
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
