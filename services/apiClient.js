import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

let client;

export const isZenConfigured = () =>
  Boolean(process.env.ZEN_API_BASE_URL?.trim());

const getApiClient = () => {
  if (client) return client;

  const baseURL = process.env.ZEN_API_BASE_URL?.trim();
  if (!baseURL) {
    throw new Error("ZEN_API_BASE_URL is required for Zen sync operations.");
  }

  client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      "x-api-key": process.env.ZEN_API_KEY,
    },
  });

  return client;
};

const apiClient = {
  get: (...args) => getApiClient().get(...args),
  post: (...args) => getApiClient().post(...args),
};

export default apiClient;
