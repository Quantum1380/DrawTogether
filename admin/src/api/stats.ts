import http from "./request";
import type { Stats, ApiResponse } from "@/types";

export const statsApi = {
  get: () =>
    http.get<ApiResponse<Stats>>("/admin/stats").then((r) => r.data.data),
};
