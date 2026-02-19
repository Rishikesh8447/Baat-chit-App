import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";
import crypto from "crypto";

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const signup=async(req,res)=>{
    const{fullName,email,password}=req.body
 try {// Hash password

    if(!fullName|| !email ||!password){
           return res.status(400).json({message:"All fields are required"});
    }
    
    if(password.length<6){
        return res.status(400).json({message:"Password must be atleast 6 character"});
    }
    const normalizedFullName = fullName.trim();
    const user=await User.findOne({email})
    if (user) return res.status(400).json({message:"email already exists"});
    const existingNameUser = await User.findOne({
      fullName: { $regex: `^${normalizedFullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (existingNameUser) return res.status(400).json({message:"username already exists"});
    const salt=await bcrypt.genSalt(10)
    const hashedPassword= await bcrypt.hash(password,salt)

    const newUser= new User({
        fullName: normalizedFullName,
        email,
        password:hashedPassword
    })
    if(newUser){//generate jwt token here
generateToken(newUser._id,res)
await newUser.save();

res.status(201).json({
    _id:newUser._id,
    fullName:newUser.fullName,
    email:newUser.email,
    profilePic:newUser.profilePic
});
    }
    else{
        res.status(400).json({message:"Invalid user Data"});
    }

 } catch (error) {
    console.log("Error in signup controller",error.message);
    res.status(500).json({message:"Internal server error"});
 }
};

export const login= async(req,res)=>{
    const {email,password}=req.body
  try {
    const user=await User.findOne({email});

    if(!user){
        return res.status(400).json({message:"Invalid credentials"});
    }
 const isPasswordCorrect =await bcrypt.compare(password,user.password);
 if(!isPasswordCorrect){
     return res.status(400).json({message:"Invalid credentials"});
 }
 generateToken(user._id,res)

 res.status(200).json({
_id:user._id,
fullName:user.fullName,
    email:user.email,
    profilePic:user.profilePic
});
    
  } catch (error) {
     console.log("Error in login controller",error.message);
    res.status(500).json({message:"Internal server error"});
    
  }
};

export const logout=(req,res)=>{
  try {
    res.cookie("jwt","",{maxAge:0})
    res.status(200).json({message:"Logged out successfully"});
    
  } catch (error) {
    console.log("Error in Logout Controller",error.message);
    res.status(500).json({message:"Internal server error"})
  }
};

export const  updateProfile=async(req,res)=>{
    try {
        const {profilePic}=req.body;
const userId=req.user._id;

if(!profilePic){
    return res.status(400).json({
        message:"Profile Pic is required"
    });
}
const uploadResponse=await cloudinary.uploader.upload(profilePic)
const updatedUser=await User.findByIdAndUpdate(userId,{profilePic:uploadResponse.secure_url},{new:true});

res.status(200).json(updatedUser)
    } catch (error) {
        console.log("error in update profile:",error);
        res.status(500).json({message:"Internal Server error"});
    }
}

export const checkAuth=(req,res)=>{
    try {
        res.status(200).json(req.user);
    } catch (error) {
        console.log("Error in checkAuth controller",error.message);
        res.status(500).json({message:"Internal server error"});
    }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const genericResponse = {
      message: "If this email exists, a reset link has been sent",
    };

    if (!email) return res.status(200).json(genericResponse);

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(genericResponse);

    const rawResetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashResetToken(rawResetToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const requestOrigin = req.get("origin");
    const frontendBaseUrl = process.env.FRONTEND_URL || requestOrigin || "http://localhost:5173";
    const baseUrl = frontendBaseUrl.replace(/\/+$/, "");
    const resetLink = `${baseUrl}/reset-password/${rawResetToken}`;

    // Return resetLink directly so reset flow works without email provider setup.
    return res.status(200).json({ ...genericResponse, resetLink });
  } catch (error) {
    console.log("Error in forgotPassword controller", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) return res.status(400).json({ message: "Invalid or expired reset token" });
    if (!password) return res.status(400).json({ message: "Password is required" });
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.log("Error in resetPassword controller", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
