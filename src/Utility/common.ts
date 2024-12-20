import axios from 'axios';

/**
 * For making http requests
 * @param url
 * @param method
 * @param data
 * @returns
 */
export async function fetchRequest(
	url: string,
	method: string,
	data: any = null,
) {
	try {
		const result = await axios({
			method,
			url,
			data,
		});
		return {
			error: false,
			data: result.data,
		};
	} catch (error) {
		console.error('error while get ', url, error);
		return {
			error: true,
			data: null,
		};
	}
}

/**
 * Log messages with colors
 * @param msg
 * @param msgColor
 * @param data
 * @param dataColor
 */
export function log(
	msg: string,
	msgColor: string,
	data: any,
	dataColor: string,
) {
	console.log(`${msgColor}${msg}${dataColor}${data}\x1b[0m`);
}

/**
 * Converts exponent numbers to normal number
 * @param num
 * @returns string
 */
export const noExponent = function (num: number | string) {
	try {
		const data = String(num).split(/[eE]/);
		if (data.length === 1) return data[0];
		let z = '';
		const sign = Number(num) < 0 ? '-' : '';
		const str = data[0].replace('.', '');
		let mag = Number(data[1]) + 1;
		if (mag < 0) {
			z = `${sign}0.`;
			while (mag++) z += '0';
			return z + str.replace(/^\-/, '');
		}
		mag -= str.length;
		while (mag--) z += '0';
		return str + z;
	} catch (error) {
		console.log('Exponent error', error);
		return '0';
	}
};

/**
 * Tell number is exponential or not
 * @param str string
 * @returns boolean
 */
export function isExponentialNumber(str: string) {
	return str.includes('e');
}

export function arrNoExponent(item: any[]) {
	item.forEach((e, i) => {
		if (typeof e === 'object') {
			Object.keys(e).forEach((k) => {
				if (isOnyNumbers(e[k])) {
					e[k] = noExponent(e[k]);
				}
			});
		} else {
			item[i] = noExponent(e);
		}
	});
	return item;
}

/**
 * Tell number is even or not
 * @param num number
 * @returns
 */
export function isEven(num: number) {
	const res = num % 2 === 0;
	return res ?? false;
}

export function isOnyNumbers(val: string | number) {
	const num = val.toString();
	const regex = /^[-+]?\d*\.?\d+$/;
	return regex.test(num);
}

export function isAlphaNumeric(val: string | number) {
	const str = val.toString();
	const regex = /^[a-fA-F0-9]{64}$/;
	return regex.test(str);
}
