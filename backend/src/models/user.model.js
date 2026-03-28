import mongoose from "mongoose";
 const userSchema=new mongoose.Schema(
{
    email:{
        type:String,
        required:true,
        unique:true,
    },
    fullName:{
        type:String,
        required:true,
    },
    password:{
        type:String,
        required:true,
        minlength:6,
    },
    profilePic:{
        type:String,
        default:"",
    },
    lastSeen: {
        type: Date,
        default: null,
    },
    resetPasswordToken: {
        type: String,
        default: null,
    },
    resetPasswordExpiresAt: {
        type: Date,
        default: null,
 },
},{timestamps:true}

 );
 userSchema.index({ fullName: 1 });
 const User=mongoose.model("User",userSchema);
 export default User;
