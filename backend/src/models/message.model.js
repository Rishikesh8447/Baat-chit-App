import mongoose from "mongoose";

const messageSchema=new mongoose.Schema(
    {
senderId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true,
},
receiverId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:false,
},
groupId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Group",
    default:null,
},
chatType:{
    type:String,
    enum:["direct","group"],
    default:"direct",
},
text:{
    type:String,
},
image:{
    type:String,
},
seen: {
    type: Boolean,
    default: false,
},
seenAt: {
    type: Date,
    default: null,
},
isEdited: {
    type: Boolean,
    default: false,
},
editedAt: {
    type: Date,
    default: null,
},
isDeleted: {
    type: Boolean,
    default: false,
},
deletedAt: {
    type: Date,
    default: null,
},
},

{timestamps:true}
);

const Message=mongoose.model("Message",messageSchema);

export default Message;
