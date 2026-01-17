import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const apiClient = axios.create({
    baseURL: 'https://api.zen-urbancode.in',
    headers: {
        'x-api-key': process.env.API_KEY
    }
});

export default apiClient;
