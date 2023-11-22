const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var jwt = require("jsonwebtoken");
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.sopxnju.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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
    const paymentDB = database.collection("payment");

    // jwt releted api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    // middleware for verify token
    const verifyToken = (req, res, next) => {
      const authorizationHeader = req.headers.authorization;
      console.log("inside verify token", authorizationHeader);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authorizationHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          if (err.name === "TokenExpiredError") {
            return res.status(401).send({ message: "Token has expired" });
          }
          return res.status(401).send({ message: "Invalid token" });
        }
        req.decoded = decoded;
        console.log(decoded);
        next();
      });
    };
    // use verify admin after verifyToken (middleWare)
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await userDB.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users releted apis

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await userDB.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userDB.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userDB.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userDB.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userDB.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userDB.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/menu", async (req, res) => {
      const cursor = menuDB.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await menuDB.findOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: id };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuDB.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/menu", async (req, res) => {
      const item = req.body;
      const result = await menuDB.insertOne(item);
      res.send(result);
    });

    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Deleting item with ID:", id);
      const query = { _id: id };
      const result = await menuDB.deleteOne(query);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const cursor = reviewDB.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // cart collections
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartDB.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (req.query.email) {
        query = { email: email };
      }
      const cursor = cartDB.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartDB.findOne(query);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartDB.deleteOne(query);
      res.send(result);
    });

    // payment intend
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating PaymentIntent:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // payment releted api

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const result = await paymentDB.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;

      // Insert the payment into the paymentDB collection
      const paymentResult = await paymentDB.insertOne(payment);

      // Prepare a query to delete items from the cartDB collection based on cartId
      const cartQuery = {
        _id: {
          $in: payment.cartId.map((id) => new ObjectId(id)),
        },
      };

      // Delete items from the cartDB collection using the prepared query
      const cartDeleteResult = await cartDB.deleteMany(cartQuery);
      console.log("Delete Result:", cartDeleteResult);

      res.send({ paymentResult, cartDeleteResult });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boss is sitting");
});

app.listen(port, () => {
  console.log(`'Bistro Boss is sitting on port ${port}'`);
});
