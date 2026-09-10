import jwt, {
  JsonWebTokenError,
  TokenExpiredError,
} from "jsonwebtoken";

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export const generateAccessToken = (
  payload: AccessTokenPayload,
): string =>{
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET!,
    {
      expiresIn: "15m",
    },
  );
}

export const generateRefreshToken = (
  payload: RefreshTokenPayload,
): string =>{
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET!,
    {
      expiresIn: "30d",
    },
  );
}

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload =>{
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET!,
  ) as AccessTokenPayload;
}

export const verifyRefreshToken = (
  token: string,
): RefreshTokenPayload => {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET!,
  ) as RefreshTokenPayload;
}

export const isTokenExpired = (error: unknown): boolean => {
  return error instanceof TokenExpiredError;
}

export const isInvalidToken = (error: unknown): boolean => {
  return error instanceof JsonWebTokenError;
}