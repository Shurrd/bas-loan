import axios from "axios";
import config from "@/@config";

export const httpClient = axios.create({
    baseURL: config.baseURL,
    timeout: config.httpTimeout,
    headers: { "Content-Type": "application/json" },
});
