import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function createAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}
