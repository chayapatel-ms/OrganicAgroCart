
import "dotenv/config";
import mongoose from "mongoose";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import User from "../models/User.js";

const rl = readline.createInterface({ input, output });

try {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from your .env file.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const name = (await rl.question("Admin name: ")).trim();
  const email = (await rl.question("Admin email: "))
    .trim()
    .toLowerCase();
  const password = await rl.question(
    "Create admin password (minimum 8 characters): "
  );

  if (!name || !email || password.length < 8) {
    throw new Error(
      "Enter a name, valid email, and password of at least 8 characters."
    );
  }

  let user = await User.findOne({ email }).select("+password");

  if (user) {
    console.log("Existing account found. Updating its role to admin.");

    user.name = name;
    user.password = password;
    user.role = "admin";
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      password,
      role: "admin"
    });
  }

  console.log("\nAdmin account is ready!");
  console.log("Email:", email);
  console.log("Role:", user.role);
  console.log("Now log in through the Admin Dashboard.");
} catch (error) {
  console.error("\nAdmin setup failed:", error.message);
} finally {
  rl.close();
  await mongoose.disconnect().catch(() => {});
}
