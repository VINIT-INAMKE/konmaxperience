export interface LeaderboardUser {
  id: string;
  name: string;
  xp_total: number;
  level: number;
  function: string;
}

export interface LeaderboardResponse {
  enabled: boolean;
  users: LeaderboardUser[];
}
