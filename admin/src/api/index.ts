import http from "./request";
import type { Admin, ApiResponse } from "@/types";

export const adminApi = {
  login: (username: string, password: string) =>
    http
      .post<ApiResponse<{ token: string; admin: Admin }>>("/admin/login", {
        username,
        password,
      })
      .then((r) => r.data.data),

  getProfile: () =>
    http.get<ApiResponse<Admin>>("/admin/profile").then((r) => r.data.data),

  logout: () => http.post("/admin/logout").then((r) => r.data),
};
