// Importa Express para crear la aplicación del servidor
import express from 'express';

// Importa cookie-parser para manejar cookies en las peticiones
import cookieParser from 'cookie-parser';

// Importa cors para habilitar Cross-Origin Resource Sharing
import cors from "cors";

// Importa todas las rutas de la aplicación
import productsRoutes from './src/routes/products.js';
import mediaRoutes from './src/routes/media.js';
import loginRoutes from './src/routes/login.js';
import logoutRoutes from './src/routes/logout.js';
import registerClientsRoutes from './src/routes/registerClients.js';
import customProductsRoutes from './src/routes/customProducts.js';
import shoppingCartRoutes from './src/routes/shoppingCart.js';
import salesRoutes from './src/routes/sales.js';
import clientsRoutes from './src/routes/clients.js';
import reviewsRoutes from './src/routes/reviews.js';
import categoriesRoutes from './src/routes/categories.js';

// Importar rutas de recuperación de contraseña
import passwordResetRoutes from './src/routes/passwordReset.js';

// Importar rutas de verificación de email
import emailVerificationRoutes from './src/routes/emailVerification.js';

// Importar rutas de chat
import chatRoutes from './src/routes/chat.js';

// Crea la instancia de la aplicación Express
const app = express();

// ===== ORDEN CRÍTICO DE MIDDLEWARE =====

// 1. CORS DEBE IR PRIMERO (MUY IMPORTANTE PARA COOKIES)
app.use(
   cors({
       origin: "http://localhost:5173",
       credentials: true,  // ¡CRUCIAL PARA COOKIES!
   })
);

// 2. MIDDLEWARE DE PARSING (DESPUÉS DE CORS)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb' }));

// 3. COOKIE PARSER (ANTES DE LAS RUTAS)
app.use(cookieParser());

// ===== MIDDLEWARE DE DEBUG PARA COOKIES =====
app.use((req, res, next) => {
    if (req.path.includes('/api/chat')) {
        console.log('🔍 DEBUG MIDDLEWARE - Ruta de chat detectada');
        console.log('📍 Path:', req.path);
        console.log('🍪 Cookies en middleware:', req.cookies);
        console.log('🔑 AuthToken presente:', !!req.cookies.authToken);
    }
    next();
});

// ===== CONFIGURACIÓN DE RUTAS =====
app.use('/api/products', productsRoutes);
app.use('/api/media', mediaRoutes);
app.use("/api/registerCustomers", registerClientsRoutes);
app.use("/api/login", loginRoutes);
app.use("/api/logout", logoutRoutes);
app.use("/api/customProducts", customProductsRoutes);
app.use("/api/shoppingCart", shoppingCartRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/categories", categoriesRoutes);

// Rutas de recuperación de contraseña
app.use('/api/passwordReset', passwordResetRoutes);

// Rutas de verificación de email
app.use('/api/emailVerification', emailVerificationRoutes);

// ===== RUTAS DE CHAT (CON DEBUG ADICIONAL) =====
app.use('/api/chat', (req, res, next) => {
    console.log('🚀 Ruta de chat accedida:', req.method, req.path);
    console.log('🍪 Cookies disponibles:', Object.keys(req.cookies));
    next();
}, chatRoutes);

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====
app.use((err, req, res, next) => {
    console.error('💥 Error en aplicación:', err);
    
    // Si es error de JWT
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado',
            error: err.message
        });
    }
    
    // Error genérico
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
    });
});

// ===== MIDDLEWARE PARA 404 =====
app.use('*', (req, res) => {
    console.log('❌ Ruta no encontrada:', req.method, req.originalUrl);
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
        path: req.originalUrl
    });
});

// Exporta la aplicación para ser utilizada en otros módulos
export default app;