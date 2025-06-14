const { MongoClient } = require('mongodb');

// Singleton MongoDB client
let mongoClient;

async function initDB() {
  try {
     const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}.mongodb.net/?retryWrites=true&w=majority`;
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 50,      // Maximum number of connections in the pool
      minPoolSize: 10,      // Minimum connections to keep open
      socketTimeoutMS: 30000, // Timeout for operations
      connectTimeoutMS: 5000, // Timeout for initial connection
    });
    
    await mongoClient.connect();
    console.log('Connected to MongoDB with connection pooling');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1); // Crash the app if DB fails to connect
  }
}

// Initialize the pool when the server starts
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