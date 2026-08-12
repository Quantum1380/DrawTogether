import http from "./request";
import type {
  Player,
  ApiResponse,
  PageResult,
  UserContactsData,
  UserFriendsData,
} from "@/types";

export interface PlayerQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: "online" | "offline" | "banned" | "";
}

export const playerApi = {
  list: (params: PlayerQuery) =>
    http
      .get<ApiResponse<PageResult<Player>>>("/admin/players", { params })
      .then((r) => r.data.data),

  detail: (id: string) =>
    http
      .get<ApiResponse<Player>>(`/admin/players/${id}`)
      .then((r) => r.data.data),

  contacts: (id: string, registeredOnly = false) =>
    http
      .get<ApiResponse<UserContactsData>>(`/admin/players/${id}/contacts`, {
        params: registeredOnly ? { registered: "true" } : {},
      })
      .then((r) => r.data.data),

  friends: (id: string) =>
    http
      .get<ApiResponse<UserFriendsData>>(`/admin/players/${id}/friends`)
      .then((r) => r.data.data),

  ban: (id: string, reason: string) =>
    http
      .post<ApiResponse<Player>>(`/admin/players/${id}/ban`, { reason })
      .then((r) => r.data.data),

  unban: (id: string) =>
    http
      .post<ApiResponse<Player>>(`/admin/players/${id}/unban`)
      .then((r) => r.data.data),
};
