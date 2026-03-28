import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    groupPic: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

groupSchema.index({ members: 1, updatedAt: -1 });
groupSchema.index({ admin: 1 });

const Group = mongoose.model("Group", groupSchema);

export default Group;
