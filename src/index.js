require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const partsRoutes = require('./routes/parts');
const movementsRoutes = require('./routes/movements');
const usersRoutes = require('./routes/users');
const returnsRoutes = require('./routes/returns');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.use('/api/auth', authRoutes);
app.use('/api/parts', partsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/returns', returnsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
