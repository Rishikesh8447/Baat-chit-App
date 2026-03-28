import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env.js";

const cookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "strict",
  secure: isProduction,
};

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, cookieOptions);
  return token;
};

export const clearAuthCookie = (res) => {
  res.clearCookie("jwt", cookieOptions);
};
