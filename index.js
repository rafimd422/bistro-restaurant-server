const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000;
require('dotenv').config()

app.use(cors())
app.use(express.json())





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.sopxnju.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("bristoDB");
    const menuDB = database.collection("menu");
    const reviewDB = database.collection("reviews");
    const cartDB = database.collection("carts");
    const userDB = database.collection("users");

// users releted apis

app.post('/users', async(req,res) => {
  const user = req.body;
  const result = await userDB.insertOne(user)
  res.send(result)
})

app.get('/menu', async(req, res) => {
   const cursor = menuDB.find()
   const result = await cursor.toArray()
   res.send(result)
})
app.get('/reviews', async(req, res) => {
   const cursor = reviewDB.find()
   const result = await cursor.toArray()
   res.send(result)
})
// cart collections
app.post('/carts', async(req, res)=> {
  const cartItem = req.body;
  const result = await cartDB.insertOne(cartItem)
  res.send(result)
})

app.get('/carts', async(req, res) => {
  const email = req.query.email
  let query = {}
  if(req.query.email){
    query = {email:email}
  }
  const cursor = cartDB.find(query)
  const result = await cursor.toArray()
  res.send(result)
})

 app.delete('/carts/:id', async(req, res) => {
   const id = req.params.id
   const query = {_id: new ObjectId(id)}
   const result = await cartDB.deleteOne(query)
   res.send(result)
 })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('boss is sitting')
})

app.listen(port, () => {
    console.log(`'Bistro Boss is sitting on port ${port}'`)
})