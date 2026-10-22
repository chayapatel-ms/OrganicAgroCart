import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function migrate() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  const source = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: "test"
    })
    .asPromise();

  const target = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: "organicagrocart"
    })
    .asPromise();

  try {
    for (const name of ["users", "products"]) {
      const sourceCollection = source.db.collection(name);
      const targetCollection = target.db.collection(name);

      const documents = await sourceCollection.find({}).toArray();

      if (documents.length === 0) {
        console.log(`${name}: no source documents to copy.`);
        continue;
      }

      const operations = documents.map((document) => ({
        updateOne: {
          filter: { _id: document._id },
          update: { $setOnInsert: document },
          upsert: true
        }
      }));

      await targetCollection.bulkWrite(operations, {
        ordered: false
      });

      console.log(
        `${name}: source=${documents.length}, ` +
        `destination=${await targetCollection.countDocuments()}`
      );
    }

    console.log("Migration finished.");
  } finally {
    await source.close();
    await target.close();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
