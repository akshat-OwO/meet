export interface MeetingEntry {
  url: string;
  name: string;
  email: string;
}

export interface UserSession {
  refreshToken: string;
  email: string;
  name: string;
}

/** Data stored in token:<email> KV entries. */
export interface StoredToken {
  refreshToken: string;
  name: string;
}
