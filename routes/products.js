
import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  authenticateToken,
  requireRole
} from "../middleware/auth.js";

const router = express.Router();

const organicMethods = [
  "Organic",
  "Natural",
  "Integrated",
  "Conventional",
  "Other"
];

const pesticideOptions = ["Yes", "No", "Unknown"];

// GET: Farmer's own products
router.get(
  "/mine",
  authenticateToken,
  requireRole("farmer"),
  async (req, res) => {
    try {
      const products = await Product.find({
        farmer: req.user.userId
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      console.error("Farmer products error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load your products."
      });
    }
  }
);

// GET: Sales summary for the logged-in farmer
router.get(
  "/sales/summary",
  authenticateToken,
  requireRole("farmer"),
  async (req, res) => {
    try {
      // Get only products belonging to this farmer.
      const products = await Product.find({
        farmer: req.user.userId
      })
        .select("_id name price unit")
        .lean();

      const productMap = new Map(
        products.map(product => [
          String(product._id),
          product
        ])
      );

      const productIds = products.map(product => product._id);

      // Find orders containing this farmer's products.
      // Cancelled orders are excluded from sales totals.
      const orders = productIds.length
        ? await Order.find({
            "items.product": { $in: productIds },
            status: { $ne: "Cancelled" }
          })
            .sort({ createdAt: -1 })
            .lean()
        : [];

      let totalSalesValue = 0;
      let deliveredSalesValue = 0;
      let orderedUnits = 0;
      let deliveredUnits = 0;

      const orderIds = new Set();
      const salesByProduct = new Map();

      for (const order of orders) {
        let containsFarmerProduct = false;

        for (const item of order.items || []) {
          const product = productMap.get(
            String(item.product)
          );

          // Ignore products belonging to other farmers.
          if (!product) {
            continue;
          }

          containsFarmerProduct = true;

          const quantity = Number(item.quantity) || 0;

          // Prefer the stored order subtotal, not today's product price.
          const subtotal =
            Number(item.subtotal) ||
            Number(item.price) * quantity;

          orderedUnits += quantity;
          totalSalesValue += subtotal;

          if (order.status === "Delivered") {
            deliveredUnits += quantity;
            deliveredSalesValue += subtotal;
          }

          const productId = String(item.product);

          const previous = salesByProduct.get(productId) || {
            productId,
            name: item.name || product.name,
            unit: item.unit || product.unit,
            orderedUnits: 0,
            deliveredUnits: 0,
            salesValue: 0,
            deliveredSalesValue: 0
          };

          previous.orderedUnits += quantity;
          previous.salesValue += subtotal;

          if (order.status === "Delivered") {
            previous.deliveredUnits += quantity;
            previous.deliveredSalesValue += subtotal;
          }

          salesByProduct.set(productId, previous);
        }

        if (containsFarmerProduct) {
          orderIds.add(String(order._id));
        }
      }

      const productSales = [...salesByProduct.values()]
        .map(item => ({
          ...item,
          salesValue: Number(item.salesValue.toFixed(2)),
          deliveredSalesValue: Number(
            item.deliveredSalesValue.toFixed(2)
          )
        }))
        .sort((a, b) => b.orderedUnits - a.orderedUnits);

      const bestSeller = productSales.length
        ? {
            productId: productSales[0].productId,
            name: productSales[0].name,
            unit: productSales[0].unit,
            orderedUnits: productSales[0].orderedUnits
          }
        : null;

      return res.json({
        success: true,
        summary: {
          // Includes all non-cancelled orders, including pending ones.
          totalSalesValue: Number(
            totalSalesValue.toFixed(2)
          ),

          // Only orders marked Delivered.
          deliveredSalesValue: Number(
            deliveredSalesValue.toFixed(2)
          ),

          orderedUnits,
          deliveredUnits,
          orderCount: orderIds.size,
          bestSeller
        },
        salesByProduct: productSales
      });
    } catch (error) {
      console.error("Farmer sales summary error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load sales summary."
      });
    }
  }
);

// GET: Products awaiting approval for sale
router.get(
  "/pending",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const products = await Product.find({
        verificationStatus: "pending"
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      console.error("Pending products error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load pending products."
      });
    }
  }
);

// GET: All products for admin
router.get(
  "/admin/all",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const products = await Product.find()
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      console.error("All admin products error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load all products."
      });
    }
  }
);

// PATCH: Admin approves or rejects a product for sale
router.patch(
  "/:id/verification",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID."
        });
      }

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be approved or rejected."
        });
      }

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found."
        });
      }

      product.verificationStatus = status;
      await product.save();

      return res.json({
        success: true,
        message: `Product ${status} successfully.`,
        product
      });
    } catch (error) {
      console.error("Product verification error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update product verification."
      });
    }
  }
);

// PATCH: Admin reviews organic claims separately
router.patch(
  "/:id/organic-verification",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID."
        });
      }

      if (!["verified", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Organic status must be verified or rejected."
        });
      }

      if (
        typeof reviewNotes !== "string" ||
        !reviewNotes.trim() ||
        reviewNotes.trim().length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide review notes (maximum 1000 characters)."
        });
      }

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found."
        });
      }

      const details = product.organicDetails;

      if (
        !details ||
        details.organicVerificationStatus !== "pending"
      ) {
        return res.status(400).json({
          success: false,
          message: "This product has no pending organic claim."
        });
      }

      details.organicVerificationStatus = status;
      details.adminReviewNotes = reviewNotes.trim();
      details.reviewedAt = new Date();
      details.reviewedBy = req.user.userId;

      await product.save();

      return res.json({
        success: true,
        message: `Organic claim ${status}.`,
        product
      });
    } catch (error) {
      console.error("Organic verification error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update organic verification."
      });
    }
  }
);

// GET: Public shop shows approved products with farmer names
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({
      verificationStatus: "approved"
    })
      .sort({ createdAt: -1 })
      .lean();

    const farmerIds = [
      ...new Set(
        products
          .map(product => product.farmer)
          .filter(id => mongoose.isValidObjectId(id))
          .map(id => String(id))
      )
    ];

    const farmers = farmerIds.length
      ? await User.find({
          _id: { $in: farmerIds }
        })
          .select("_id name")
          .lean()
      : [];

    const farmerNames = new Map(
      farmers.map(farmer => [
        String(farmer._id),
        farmer.name
      ])
    );

    const productsWithFarmerNames = products.map(product => ({
      ...product,
      farmerName:
        farmerNames.get(String(product.farmer)) ||
        (
          !mongoose.isValidObjectId(product.farmer)
            ? product.farmer
            : "Local Farmer"
        )
    }));

    return res.json({
      success: true,
      count: productsWithFarmerNames.length,
      products: productsWithFarmerNames
    });
  } catch (error) {
    console.error("Public products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch products."
    });
  }
});

// POST: Farmer submits a product and its farming details
router.post(
  "/",
  authenticateToken,
  requireRole("farmer"),
  async (req, res) => {
    try {
      
const {
  name,
  category,
  price,
  unit,
  stockQuantity,
  emoji,
  image,
  location,
  organicDetails
} = req.body;


      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        !["Vegetables", "Fruits"].includes(category) ||
        price === undefined ||
        price === null ||
        price === "" ||
        !Number.isFinite(Number(price)) ||
        Number(price) <= 0 ||
        typeof unit !== "string" ||
        !unit.trim() ||
        typeof location !== "string" ||
        !location.trim() ||
        location.trim().length > 100 ||
        stockQuantity === undefined ||
        stockQuantity === null ||
        stockQuantity === "" ||
        !Number.isInteger(Number(stockQuantity)) ||
        Number(stockQuantity) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid product details and stock quantity."
        });
      }

let imageUrl = "";

if (image !== undefined && image !== "") {
  if (
    typeof image !== "string" ||
    image.length > 2048
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid product image URL."
    });
  }

  try {
    const parsedImageUrl = new URL(image);

    if (!["http:", "https:"].includes(parsedImageUrl.protocol)) {
      throw new Error("Invalid protocol");
    }

    imageUrl = parsedImageUrl.href;
  } catch {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid HTTP or HTTPS image URL."
    });
  }
}

      if (
        organicDetails !== undefined &&
        (
          !organicDetails ||
          typeof organicDetails !== "object" ||
          Array.isArray(organicDetails)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Organic details must be an object."
        });
      }

      const details = organicDetails || {};

      const farmingMethod = details.farmingMethod || "Other";
      const pesticideUse =
        details.chemicalPesticidesUsed || "Unknown";

      if (!organicMethods.includes(farmingMethod)) {
        return res.status(400).json({
          success: false,
          message: "Invalid farming method."
        });
      }

      if (!pesticideOptions.includes(pesticideUse)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pesticide-use selection."
        });
      }

      const textFields = [
        ["fertilizerUsed", 500],
        ["pestControlMethod", 500],
        ["pesticideDetails", 1000],
        ["certificationName", 200],
        ["certificationNumber", 100],
        ["certificateReference", 500],
        ["farmerNotes", 1000]
      ];

      for (const [field, maxLength] of textFields) {
        if (
          details[field] !== undefined &&
          (
            typeof details[field] !== "string" ||
            details[field].length > maxLength
          )
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field} value or length.`
          });
        }
      }

      const harvestDate = details.harvestDate || null;
      const certificationValidUntil =
        details.certificationValidUntil || null;

      for (const [field, value] of [
        ["harvestDate", harvestDate],
        ["certificationValidUntil", certificationValidUntil]
      ]) {
        if (
          value !== null &&
          (
            typeof value !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(Date.parse(value)) ||
            new Date(value).toISOString().slice(0, 10) !== value
          )
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}. Use YYYY-MM-DD.`
          });
        }
      }

      if (harvestDate && new Date(harvestDate) > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Harvest date cannot be in the future."
        });
      }

      if (
        details.certificationProvided !== undefined &&
        typeof details.certificationProvided !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid certification selection."
        });
      }

      const product = await Product.create({
        name: name.trim(),
        category,
        price: Number(price),
        stockQuantity: Number(stockQuantity),
        unit: unit.trim(),
        emoji:
          typeof emoji === "string" && emoji.trim()
            ? emoji.trim().slice(0, 10)
            : "🌱",
            image: imageUrl,
        farmer: req.user.userId,
        location: location.trim(),
        verificationStatus: "pending",
        organicDetails: {
          farmingMethod,
          fertilizerUsed: details.fertilizerUsed || "",
          pestControlMethod: details.pestControlMethod || "",
          chemicalPesticidesUsed: pesticideUse,
          pesticideDetails: details.pesticideDetails || "",
          harvestDate,
          certificationProvided:
            details.certificationProvided === true,
          certificationName: details.certificationName || "",
          certificationNumber: details.certificationNumber || "",
          certificationValidUntil,
          certificateReference: details.certificateReference || "",
          farmerNotes: details.farmerNotes || "",
          organicVerificationStatus: "pending",
          adminReviewNotes: "",
          reviewedAt: null,
          reviewedBy: null
        }
      });

      return res.status(201).json({
        success: true,
        message: "Product and farming details submitted for review.",
        product
      });
    } catch (error) {
      console.error("Create product error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to submit product."
      });
    }
  }
);

export default router;
