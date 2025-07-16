import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const verifyToken = (req, res, next) => {
    console.log('🔍 AUTH MIDDLEWARE - Verificando token');
    console.log('🍪 Cookies disponibles:', Object.keys(req.cookies || {}));
    console.log('📍 Ruta:', req.method, req.path);
    
    try {
        const token = req.cookies.authToken;
        
        if (!token) {
            console.log('❌ No hay token authToken');
            return res.status(401).json({ 
                success: false,
                message: 'Token de acceso requerido'
            });
        }
        
        console.log('🎫 Token encontrado (primeros 20 chars):', token.substring(0, 20));
        
        const decoded = jwt.verify(token, config.JWT.secret);
        console.log('✅ Token decodificado exitosamente:', {
            id: decoded.id,
            userType: decoded.userType,
            email: decoded.email
        });
        
        if (!decoded || !decoded.id || !decoded.userType) {
            console.log('❌ Token inválido: faltan campos requeridos');
            res.clearCookie("authToken");
            return res.status(401).json({ 
                success: false,
                message: 'Token inválido: datos incompletos'
            });
        }
        
        req.user = {
            id: decoded.id,
            userType: decoded.userType,
            email: decoded.email || null
        };
        
        console.log('✅ Usuario autenticado correctamente:', req.user);
        next();
        
    } catch (error) {
        console.error('❌ Error en autenticación:', error.message);
        res.clearCookie("authToken");
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expirado'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token inválido'
            });
        } else {
            return res.status(500).json({ 
                success: false,
                message: 'Error interno del servidor en autenticación'
            });
        }
    }
};

const verifyAdmin = (req, res, next) => {
    console.log('🔍 ADMIN MIDDLEWARE - Verificando admin');
    
    verifyToken(req, res, (err) => {
        if (err) return;
        
        if (req.user.userType !== 'admin') {
            console.log('❌ Usuario no es admin:', req.user.userType);
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Se requieren permisos de administrador'
            });
        }
        
        console.log('✅ Admin verificado correctamente');
        next();
    });
};

const verifyCustomer = (req, res, next) => {
    console.log('🔍 CUSTOMER MIDDLEWARE - Verificando cliente');
    
    verifyToken(req, res, (err) => {
        if (err) return;
        
        if (req.user.userType !== 'Customer') {
            console.log('❌ Usuario no es cliente:', req.user.userType);
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Se requieren permisos de cliente'
            });
        }
        
        console.log('✅ Cliente verificado correctamente');
        next();
    });
};

export default verifyToken;
export { verifyAdmin, verifyCustomer };