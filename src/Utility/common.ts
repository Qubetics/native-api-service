import axios from "axios";
import geoip from "geoip-lite";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json"; // import JSON instead of require
import { extractIP } from "../helper/common.helper";

countries.registerLocale(enLocale);

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
  data: any = null
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
    console.error("error while get ", url, error);
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
  dataColor: string
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
    let z = "";
    const sign = Number(num) < 0 ? "-" : "";
    const str = data[0].replace(".", "");
    let mag = Number(data[1]) + 1;
    if (mag < 0) {
      z = `${sign}0.`;
      while (mag++) z += "0";
      return z + str.replace(/^\-/, "");
    }
    mag -= str.length;
    while (mag--) z += "0";
    return str + z;
  } catch (error) {
    console.log("Exponent error", error);
    return "0";
  }
};

/**
 * Tell number is exponential or not
 * @param str string
 * @returns boolean
 */
export function isExponentialNumber(str: string) {
  return str.includes("e");
}

export function arrNoExponent(item: any[]) {
  item.forEach((e, i) => {
    if (typeof e === "object") {
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

// export const formatNodes = (nodes: any[]) =>
//   nodes
//     .map((node: any) => {
//       const ip = extractIP(node.remote_url);
//       if (ip) {
//         const geo: any = geoip.lookup(ip);
//         const countryName = countries.getName(geo?.country, "en");
//         const flagUrl = `https://flagcdn.com/w80/${geo?.country.toLowerCase()}.png`;
//         return {
//           address: node.address,
//           gigabyte_prices: Array.isArray(node.gigabyte_prices)
//             ? node.gigabyte_prices
//             : [],
//           hourly_prices: Array.isArray(node.hourly_prices)
//             ? node.hourly_prices
//             : [],
//           remote_url: node.remote_url,
//           inactive_at: node?.inactive_at ? new Date(node.inactive_at) : null,
//           status: node.status,
//           status_at: node?.status_at ? new Date(node.status_at) : null,
//           country: countryName || "Unknown",
//           city: geo?.city || "Unknown",
//           long: geo?.ll[1].toString(),
//           lat: geo?.ll[0].toString(),
//           flag_url: flagUrl,
//         };
//       }
//     })
//     .filter(Boolean); // Remove undefined entries where IP extraction failed

export const formatNodes = (nodes: any[]) =>
  nodes
    .map((node: any) => {
      const ip = extractIP(node.remote_url);
      if (!ip) return null; // return something explicitly if IP not found

      const geo: any = geoip.lookup(ip);
      const countryName = countries.getName(geo?.country, "en");
      const flagUrl = `https://flagcdn.com/w80/${geo?.country?.toLowerCase()}.png`;

      return {
        address: node.address,
        gigabyte_prices: Array.isArray(node.gigabyte_prices)
          ? node.gigabyte_prices
          : [],
        hourly_prices: Array.isArray(node.hourly_prices)
          ? node.hourly_prices
          : [],
        remote_url: node.remote_url,
        inactive_at: node?.inactive_at ? new Date(node.inactive_at) : null,
        status: node.status,
        status_at: node?.status_at ? new Date(node.status_at) : null,
        country: countryName || "Unknown",
        city: geo?.city || "Unknown",
        long: geo?.ll?.[1]?.toString() || "0",
        lat: geo?.ll?.[0]?.toString() || "0",
        flag_url: flagUrl,
      };
    })
    .filter(Boolean); // Remove null entries
