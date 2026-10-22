
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product.js";

dotenv.config();

const sampleProducts = [
  {
    name: "Fresh Tomatoes",
    category: "Vegetables",
    price: 30,
    unit: "kg",
    emoji: "🍅",
    farmer: "Ramesh",
    location: "Bengaluru",
    verificationStatus: "pending"
  },
  {
    name: "Organic Carrots",
    category: "Vegetables",
    price: 40,
    unit: "kg",
    emoji: "🥕",
    farmer: "Suresh",
    location: "Mysuru",
    verificationStatus: "pending"
  },
  {
    name: "Fresh Potatoes",
    category: "Vegetables",
    price: 25,
    unit: "kg",
    emoji: "🥔",
    farmer: "Mahesh",
    location: "Dharwad",
    verificationStatus: "pending"
  },
  {
    name: "Sweet Apples",
    category: "Fruits",
    price: 120,
    unit: "kg",
    emoji: "🍎",
    farmer: "Lakshmi",
    location: "Himachal Pradesh",
    verificationStatus: "pending"
  },
  {
    name: "Fresh Bananas",
    category: "Fruits",
    price: 50,
    unit: "dozen",
    emoji: "🍌",
    farmer: "Anand",
    location: "Shivamogga",
    verificationStatus: "pending"
  },
  {
    name: "Sweet Oranges",
    category: "Fruits",
    price: 70,
    unit: "kg",
    emoji: "🍊",
    farmer: "Geetha",
    location: "Coorg",
    verificationStatus: "pending"
  }
];

async function seedProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB Atlas.");

    const count = await Product.countDocuments();

    if (count > 0) {
      console.log(
        `Products already exist (${count}). No products were added.`
      );
      return;
    }

    await Product.insertMany(sampleProducts);
    console.log("Successfully added six sample products!");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();
