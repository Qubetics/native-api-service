import { Reader } from "@maxmind/geoip2-node";
import * as fs from "fs";
const { MAXMIND_CONFIG } = require("../constant/index");

class MaxMindHelper {
  private reader: Reader | null = null;

  constructor() {
    this.initializeReader();
  }

  private initializeReader() {
    try {
      // Check if database file exists
      if (!fs.existsSync(MAXMIND_CONFIG.DATABASE_PATH)) {
        throw new Error(`MaxMind database file not found at:  ${MAXMIND_CONFIG.DATABASE_PATH}`);
      }

      // Read the database file into a buffer
      const dbBuffer = fs.readFileSync(MAXMIND_CONFIG.DATABASE_PATH);
      this.reader = Reader.openBuffer(dbBuffer);
      console.log("MaxMind database loaded successfully");
    } catch (error) {
      console.error("Failed to load MaxMind database:", error);
      this.reader = null;
    }
  }

  async getLocationData(ip: string): Promise<any> {
    // Check cache first
    if (!this.reader) {
      throw new Error("MaxMind database not loaded");
    }

    try {
      const response = (this.reader as any).city(ip);

      const locationData = {
        country: response.country?.names?.en || "Unknown",
        countryCode: response.country?.isoCode || "Unknown",
        region: response.subdivisions?.[0]?.names?.en || "Unknown",
        regionCode: response.subdivisions?.[0]?.isoCode || "Unknown",
        city: response.city?.names?.en || "Unknown",
        latitude: response.location?.latitude || null,
        longitude: response.location?.longitude || null,
        timezone: response.location?.timeZone || "Unknown",
        postal: response.postal?.code || "Unknown",
        accuracy: response.location?.accuracyRadius || null,
        // Add more fields as needed
        query: ip,
        status: "success",
      };

      return locationData;
    } catch (error) {
      console.error(`Failed to get location for IP: ${ip}, error`);
      throw error;
    }
  }

  async close() {
    // MaxMind Reader doesn't have a close method
    // The reader will be garbage collected when the helper is destroyed
    this.reader = null;
  }
}

export default new MaxMindHelper();