// Importar Express para crear el enrutador
import express from "express";
// Importar el controlador de chat
import chatController from "../controllers/chatController.js";
// Importar middlewares de autenticación
import verifyToken, { verifyAdmin, verifyCustomer } from "../middlewares/validateAuthToken.js";

// Crear una instancia del enrutador de Express
const router = express.Router();

// ===== RUTAS PARA CLIENTES =====

// GET /conversation/:clientId - Obtener o crear conversación del cliente autenticado
// Solo los clientes pueden acceder a su propia conversación
router.get("/conversation/:clientId", verifyCustomer, chatController.getOrCreateConversation);

// ===== RUTAS COMPARTIDAS (CLIENTES Y ADMINISTRADORES) =====

// POST /message - Enviar un mensaje (cliente o admin)
// Requiere autenticación pero puede ser usado por ambos tipos de usuario
router.post("/message", verifyToken, chatController.sendMessage);

// GET /messages/:conversationId - Obtener mensajes de una conversación
// Requiere autenticación y verificación de permisos dentro del controlador
router.get("/messages/:conversationId", verifyToken, chatController.getMessages);

// PUT /read/:conversationId - Marcar mensajes como leídos
// Requiere autenticación, usado tanto por clientes como administradores
router.put("/read/:conversationId", verifyToken, chatController.markAsRead);

// ===== RUTAS EXCLUSIVAS PARA ADMINISTRADORES =====

// GET /admin/conversations - Obtener todas las conversaciones (solo admin)
// Lista todas las conversaciones para gestión administrativa
router.get("/admin/conversations", verifyAdmin, chatController.getAllConversations);

// GET /admin/conversation/:clientId - Obtener o crear conversación para un cliente específico (admin)
// Permite al admin acceder a cualquier conversación de cliente
router.get("/admin/conversation/:clientId", verifyAdmin, chatController.getOrCreateConversation);

// PUT /admin/close/:conversationId - Cerrar conversación (solo admin)
// Permite al administrador cerrar conversaciones activas
router.put("/admin/close/:conversationId", verifyAdmin, chatController.closeConversation);

// GET /admin/stats - Obtener estadísticas de chat (solo admin)
// Proporciona métricas y estadísticas del sistema de chat
router.get("/admin/stats", verifyAdmin, chatController.getChatStats);

// Exportar el enrutador para ser usado en la aplicación principal
export default router;