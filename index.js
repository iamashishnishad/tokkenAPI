const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);
mongoose
    .connect(DB)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// User Schema and Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Product Schema and Model
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    addedBy: { type: String, required: true },
});
const Product = mongoose.model('Product', productSchema);

// Swagger configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'API for user authentication and product management',
        },
        servers: [
            {
                url: `https://tokkenapi.onrender.com`, // Use production URL
            },
        ],
    },
    apis: ['index.js'], // Points to the current file for Swagger annotations
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Secret key for JWT
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Token required' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err.message);
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

/**
 * @swagger
 * /register:
 *   post:
 *     description: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - name
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Error registering user:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /login:
 *   post:
 *     description: Login an existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful with JWT token
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid email or password
 *       500:
 *         description: Internal server error
 */
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const user = await User.findOne({ email, password });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.status(200).json({ token });
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /product:
 *   post:
 *     description: Add a new product (Authentication required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *             required:
 *               - name
 *               - price
 *     responses:
 *       201:
 *         description: Product added successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (Token required)
 *       500:
 *         description: Internal server error
 */
app.post('/product', authenticateToken, async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ message: 'Product name and price are required' });
    }
    try {
        const newProduct = new Product({ name, price, addedBy: req.user.email });
        await newProduct.save();
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (err) {
        console.error('Error adding product:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /products:
 *   get:
 *     description: Get all products (Authentication required)
 *     responses:
 *       200:
 *         description: List of products
 *       401:
 *         description: Unauthorized (Token required)
 *       500:
 *         description: Internal server error
 */
app.get('/products', authenticateToken, async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (err) {
        console.error('Error retrieving products:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @swagger
 * /users:
 *   get:
 *     description: Get all users (Authentication required)
 *     responses:
 *       200:
 *         description: List of users (without password)
 *       401:
 *         description: Unauthorized (Token required)
 *       500:
 *         description: Internal server error
 */
app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude password
        res.status(200).json(users);
    } catch (err) {
        console.error('Error retrieving users:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API documentation available at https://tokkenapi.onrender.com/api-docs`);
});