const { MongoClient } = require('mongodb');

// Singleton MongoDB client
let mongoClient;

async function initDB() {
  try {
    //  const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}.mongodb.net/?retryWrites=true&w=majority`;
    const uri = `mongodb://${process.env.COSMOSDB_ACCOUNT}:${process.env.COSMOSDB_KEY}@${process.env.COSMOSDB_ACCOUNT}.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@${process.env.COSMOSDB_ACCOUNT}@`;
    mongoClient = new MongoClient(uri, {
      retryWrites: false, // Must be false for Cosmos DB
      retryReads: false,
      appName: "@Sparkmap@", // Helps with monitoring
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      // Keep your existing pool settings
      maxPoolSize: 50,
      minPoolSize: 10
    });
    
    await mongoClient.connect();
    console.log('Connected to MongoDB with connection pooling');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1); // Crash the app if DB fails to connect
  }
}

initDB();

setInterval(async () => {
  try {
    await mongoClient.db('admin').command({ ping: 1 });
  } catch (err) {
    console.error('MongoDB connection lost, reconnecting...');
    await initDB(); // Reinitialize the pool
  }
}, 30000); // Check every 30 seconds

process.on('SIGTERM', async () => {
  await mongoClient.close();
  process.exit(0);
});

// Export the reusable client
module.exports.getDB = () => mongoClient.db(process.env.DATABASE_NAME);

module.exports.getQanaojDB = () => mongoClient.db(process.env.QANAOJ_DB_NAME)