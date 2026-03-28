import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { env } from "../config/env.js";

export const protectRoute =async(req,res,next)=>{
    try {
        const token =req.cookies.jwt

if(!token){
    return res.status(401).json({message:"Unauthorized"});
}
const decoded=jwt.verify(token,env.jwtSecret)

if(!decoded){
     return res.status(401).json({message:"Unauthorized"});
}

const user=await User.findById(decoded.userId).select("-password");

if(!user){
    return res.status(404).json({message:"User not found"});
}

req.user=user

next()

    } catch (error) {
        console.log("Error in protectRoute middleware:",error.message);
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({message:"Unauthorized"});
        }
        res.status(500).json({message:"Internal Server error"});
    }
}
