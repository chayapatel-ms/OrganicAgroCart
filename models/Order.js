
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    organicVerificationStatus: {
  type: String,
  enum: [
    "not_submitted",
    "pending",
    "verified",
    "rejected"
  ],
  default: "not_submitted"
},
    unit: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length > 0 &&
          items.length <= 50,
        message: "An order must contain between 1 and 50 items."
      }
    },

    deliveryAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true
      },
      phone: {
        type: String,
        required: true,
        trim: true
      },
      addressLine: {
        type: String,
        required: true,
        trim: true
      },
      city: {
        type: String,
        required: true,
        trim: true
      },
      state: {
        type: String,
        required: true,
        trim: true
      },
      pincode: {
        type: String,
        required: true,
        trim: true
      },
      instructions: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ""
      }
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery"],
      default: "Cash on Delivery",
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Packed",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
      ],
      default: "Pending"
    }
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
