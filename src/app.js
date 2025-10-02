    const express = require('express');
    const rateLimit = require('express-rate-limit');
    const cors = require('cors');
    const morgan = require('morgan');

    const routes = require('./routes');

    const app = express();

    // Middleware para limitar cantidad de peticiones por IP
    const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 solicitudes por IP
    standardHeaders: true, // Informar en headers sobre límites
    legacyHeaders: false, // Deshabilitar headers viejos
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.',
    });

    // Aplica rate limiter de forma global a todas las rutas
    app.use('/auth', limiter);

    // Middlewares
    app.use(cors());
    app.use(express.json());
    app.use(morgan('dev'));

    // Rutas
    app.use('/', routes);

    module.exports = app;
