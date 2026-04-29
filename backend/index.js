const express = require('express');
const mysql2 = require('mysql2');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 8081;
const INSTANCE_ID = process.env.INSTANCE_ID || 'A';
const SECRET = 'lab7secret';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = mysql2.createPool({
    host: 'db',
    user: 'root',
    password: '1234',
    database: 'lab7db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware auth
const auth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Sin token' });

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// LOGIN
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query(
        'SELECT * FROM usuarios WHERE email = ? AND password = ?',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: err });

            if (results.length === 0) {
                return res.status(401).json({ error: 'Credenciales incorrectas' });
            }

            const token = jwt.sign(
                { id: results[0].id, email },
                SECRET,
                { expiresIn: '1h' }
            );

            res.json({
                token,
                backend: `Instancia ${INSTANCE_ID} - Puerto ${PORT}`
            });
        }
    );
});

// GET productos
app.get('/productos', auth, (req, res) => {
    db.query('SELECT * FROM productos', (err, results) => {
        if (err) return res.status(500).json({ error: err });

        res.json({
            data: results,
            backend: `Instancia ${INSTANCE_ID} - Puerto ${PORT}`
        });
    });
});

// CREATE
app.post('/productos', auth, (req, res) => {
    const { nombre, descripcion, precio } = req.body;

    db.query(
        'INSERT INTO productos (nombre, descripcion, precio) VALUES (?, ?, ?)',
        [nombre, descripcion, precio],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });

            res.json({
                id: result.insertId,
                backend: `Instancia ${INSTANCE_ID} - Puerto ${PORT}`
            });
        }
    );
});

// UPDATE
app.put('/productos/:id', auth, (req, res) => {
    const { nombre, descripcion, precio } = req.body;

    db.query(
        'UPDATE productos SET nombre=?, descripcion=?, precio=? WHERE id=?',
        [nombre, descripcion, precio, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err });

            res.json({
                mensaje: 'Actualizado',
                backend: `Instancia ${INSTANCE_ID} - Puerto ${PORT}`
            });
        }
    );
});

// DELETE
app.delete('/productos/:id', auth, (req, res) => {
    db.query(
        'DELETE FROM productos WHERE id=?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err });

            res.json({
                mensaje: 'Eliminado',
                backend: `Instancia ${INSTANCE_ID} - Puerto ${PORT}`
            });
        }
    );
});

// START
app.listen(PORT, () => {
    console.log(`Instancia ${INSTANCE_ID} corriendo en puerto ${PORT}`);
});