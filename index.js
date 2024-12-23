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
const PORT = 3000;

app.use(bodyParser.json());
app.use(cors()); 

// MongoDB connection
const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);
mongoose
    .connect(DB)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));
    
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    addedBy: { type: String, required: true },
});
const Product = mongoose.model('Product', productSchema);

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
                url: `http://localhost:${PORT}`,
            },
        ],
    },
    apis: ['index.js'], // Adjust file name for Swagger annotations
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


app.get('/products', authenticateToken, async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (err) {
        console.error('Error retrieving products:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find().select('-password'); 
        res.status(200).json(users);
    } catch (err) {
        console.error('Error retrieving users:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API documentation available at http://localhost:${PORT}/api-docs`);
});
