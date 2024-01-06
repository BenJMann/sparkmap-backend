const { MongoClient } = require('mongodb');

module.exports = async () => {
    const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri);
    await client.connect();
    return client;
}