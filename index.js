const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://car-doctor-f90b0.web.app',
        'https://car-doctor-f90b0.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7ks5x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log(uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})

// middleware ...............
const logger = async (req, res, next) => {
    console.log(req.host, req.url)
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(403).send({ message: 'unauthorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(403).send({ message: 'unauthorized' })
        }
        req.user = decoded;
        next();
    })
}

const cookieOption = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const servicesCollection = client.db('carCollectionDB').collection('services');
        const bookingCollection = client.db('carCollectionDB').collection('booking');

        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, cookieOption).send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            // console.log('user for log out', user)
            res
                .clearCookie('token', { ...cookieOption, maxAge: 0 })
                .send({ success: true })
        })  

        // services related api 
        app.get('/services', async (req, res) => {
            const services = servicesCollection.find();
            const result = await services.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };

            const result = await servicesCollection.findOne(filter, options);
            res.send(result)
        })

        app.post('/services', async (req, res) => {
            const product = req.body;
            const insert = servicesCollection.insert(product);
            res.send(insert);
        })

        // booking api
        app.get('/booking', verifyToken, async (req, res) => {

            if (req.user?.email !== req.query?.email) {
                return res.status(401).send({ message: 'forbidden' })
            }

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        })

        app.patch('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const updateBooking = req.body;
            console.log(id, updateBooking)
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: updateBooking.status
                }
            }
            const result = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('car server is running');
})

app.listen(port, () => {
    console.log(`server running on port${port}`);
})