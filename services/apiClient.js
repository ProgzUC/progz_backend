import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

let client;

const getApiClient = () => {
  if (client) return client;

  const baseURL = process.env.ZEN_API_BASE_URL;
  if (!baseURL) {
    throw new Error("ZEN_API_BASE_URL is required for Zen sync operations.");
  }

  client = axios.create({
    baseURL,
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
