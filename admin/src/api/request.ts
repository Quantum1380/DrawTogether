import axios, { AxiosResponse } from "axios";

const TOKEN_KEY = "admin_token";

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY) || "",
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const instance = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

// 请求拦截器: 加 token
instance.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器: 统一处理 code 与 401
instance.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data.code !== "undefined") {
      if (data.code === 0) {
        // 返回原始 AxiosResponse,保持类型信息,调用方通过 .data 访问外层,
        // .data.data 访问内层 payload
        return response;
      }
      if (data.code === 401) {
        tokenStorage.clear();
        if (!location.hash.startsWith("#/login")) {
          location.hash = "#/login";
        }
      }
      return Promise.reject(new Error(data.message || "请求失败"));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
      location.hash = "#/login";
    }
    return Promise.reject(new Error(error.message || "网络错误"));
  },
);

export default instance;
export type { AxiosResponse };
