
import mongoose from "mongoose";

const organicDetailsSchema = new mongoose.Schema(
  {
    farmingMethod: {
      type: String,
      enum: [
        "Organic",
        "Natural",
        "Integrated",
        "Conventional",
        "Other"
      ],
      default: "Other"
    },

    fertilizerUsed: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    pestControlMethod: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    chemicalPesticidesUsed: {
      type: String,
      enum: ["Yes", "No", "Unknown"],
      default: "Unknown"
    },

    pesticideDetails: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    harvestDate: {
      type: Date,
      default: null
    },

    certificationProvided: {
      type: Boolean,
      default: false
    },

    certificationName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    },

    certificationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },

    certificationValidUntil: {
      type: Date,
      default: null
    },

    certificateReference: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    farmerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    organicVerificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "verified", "rejected"],
      default: "not_submitted"
    },

    adminReviewNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    reviewedAt: {
      type: Date,
      default: null
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      enum: ["Vegetables", "Fruits"],
      required: true
    },

    price: {
  type: Number,
  required: true,
  min: 0
},

// Available stock for this product
stockQuantity: {
  type: Number,
  required: true,
  default: 0,
  min: 0
},

    unit: {
      type: String,
      required: true
    },

    
emoji: {
  type: String,
  default: "🌱"
},

// Product photograph URL
image: {
  type: String,
  trim: true,
  default: ""
},


    farmer: {
      type: String,
      required: true
    },

    location: {
      type: String,
      required: true
    },

    // Existing approval for selling the product.
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    // Separate record for organic claims and their review.
    organicDetails: {
      type: organicDetailsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
