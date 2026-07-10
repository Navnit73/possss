import { MongoClient } from "mongodb";
import { env } from "./env";

// Ensure TLS in production
if (env.NODE_ENV === "production" && !env.MONGODB_URI.includes("tls=true") && !env.MONGODB_URI.startsWith("mongodb+srv://")) {
  throw new Error("Production MONGODB_URI must use mongodb+srv:// or include tls=true for security.");
}

const uri = env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options);
  }
  client = globalWithMongo._mongoClient;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
}

// Export a module-scoped MongoClient. By doing this in a
// separate module, the client can be shared across functions.
export default client;
