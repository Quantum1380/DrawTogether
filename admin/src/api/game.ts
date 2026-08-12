import http from "./request";
import type { GameRecord, ApiResponse, PageResult } from "@/types";

export interface GameQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const gameApi = {
  list: (params: GameQuery) =>
    http
      .get<ApiResponse<PageResult<GameRecord>>>("/admin/games", { params })
      .then((r) => r.data.data),

  detail: (id: string) =>
    http
      .get<ApiResponse<GameRecord>>(`/admin/games/${id}`)
      .then((r) => r.data.data),
};
