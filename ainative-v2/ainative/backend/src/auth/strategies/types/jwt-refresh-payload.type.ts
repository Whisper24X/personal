export type JwtRefreshPayloadType = {
  sub: string;
  username?: string;
  roles?: string[];
  businessLineId?: string;
  iat: number;
  exp: number;
};
