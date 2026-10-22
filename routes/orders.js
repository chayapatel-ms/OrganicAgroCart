import express from "express";
import mongoose from "mongoose";

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// All order routes require a logged-in customer.
router.use(authenticateToken, requireRole("customer"));

// POST /api/orders
// Create a new order using verified database prices.
router.post("/", async (req, res) => {
  try {
    const {
      items,
      deliveryAddress,
      paymentMethod = "Cash on Delivery"
    } = req.body;

    // Validate cart items.
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Please add between 1 and 50 products to your cart."
      });
    }

    if (paymentMethod !== "Cash on Delivery") {
      return res.status(400).json({
        success: false,
        message: "This payment method is not currently supported."
      });
    }

    // Validate delivery address.
    if (
      !deliveryAddress ||
      typeof deliveryAddress !== "object" ||
      Array.isArray(deliveryAddress)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide your delivery address."
      });
    }

    const requiredFields = [
      "fullName",
      "phone",
      "addressLine",
      "city",
      "state",
      "pincode"
    ];

    for (const field of requiredFields) {
      if (
        typeof deliveryAddress[field] !== "string" ||
        !deliveryAddress[field].trim()
      ) {
        return res.status(400).json({
          success: false,
          message: `Please provide ${field} in your delivery address.`
        });
      }
    }

    const phone = deliveryAddress.phone.trim();
    const pincode = deliveryAddress.pincode.trim();

    // Basic Indian mobile number validation.
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit Indian mobile number."
      });
    }

    // Validate Indian PIN code.
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit PIN code."
      });
    }

    // Validate product IDs and quantities.
    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !mongoose.isValidObjectId(item.productId)
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more product IDs are invalid."
        });
      }

      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return res.status(400).json({
          success: false,
          message: "Each product quantity must be between 1 and 99."
        });
      }

      const id = item.productId;
      const combinedQuantity =
        (quantities.get(id) || 0) + item.quantity;

      if (combinedQuantity > 99) {
        return res.status(400).json({
          success: false,
          message: "A product quantity cannot exceed 99."
        });
      }

      quantities.set(id, combinedQuantity);
    }

    const productIds = [...quantities.keys()];

    // Only approved products can be purchased.
    const products = await Product.find({
      _id: { $in: productIds },
      verificationStatus: "approved"
    }).lean();

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Some products are unavailable or not approved. Refresh your cart and try again."
      });
    }

    const productById = new Map(
      products.map((product) => [product._id.toString(), product])
    );

    let totalAmount = 0;

    // Build order items using database prices and organic status.
    const orderItems = productIds.map((id) => {
      const product = productById.get(id);
      const quantity = quantities.get(id);

      const subtotal =
        Math.round(product.price * quantity * 100) / 100;

      totalAmount += subtotal;

      return {
        product: product._id,
        name: product.name,

        // Snapshot of the organic status at purchase time.
        organicVerificationStatus:
          product.organicDetails?.organicVerificationStatus ||
          "not_submitted",

        unit: product.unit,
        quantity,
        price: product.price,
        subtotal
      };
    }); // IMPORTANT: closes the map function correctly.

    totalAmount = Math.round(totalAmount * 100) / 100;

    // Prepare a clean delivery address.
    const address = {
      fullName: deliveryAddress.fullName.trim(),
      phone,
      addressLine: deliveryAddress.addressLine.trim(),
      city: deliveryAddress.city.trim(),
      state: deliveryAddress.state.trim(),
      pincode,
      instructions:
        typeof deliveryAddress.instructions === "string"
          ? deliveryAddress.instructions.trim().slice(0, 300)
          : ""
    };

    // Save the order to MongoDB.
    const order = await Order.create({
      customer: req.user.userId,
      items: orderItems,
      deliveryAddress: address,
      totalAmount,
      paymentMethod: "Cash on Delivery"
    });

    return res.status(201).json({
      success: true,
      message: "Your order has been placed successfully!",
      order: {
        id: order._id,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error("Place order error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to place your order. Please try again."
    });
  }
});

// GET /api/orders/mine
// Customers can view only their own orders.
router.get("/mine", async (req, res) => {
  try {
    const orders = await Order.find({
      customer: req.user.userId
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: orders.length,
      orders: orders.map((order) => ({
        id: order._id,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    console.error("Get customer orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your orders."
    });
  }
});

// GET /api/orders/:id
// Customers can retrieve only their own order details.
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user.userId
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    return res.json({
      success: true,
      order: {
        id: order._id,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error("Get order details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order details."
    });
  }
});

export default router;