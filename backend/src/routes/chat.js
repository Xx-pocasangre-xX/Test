// Importar Express para crear el enrutador
import express from "express";
// Importar el controlador de chat
import chatController from "../controllers/chatController.js";
// Importar middlewares de autenticación
import verifyToken, { verifyAdmin, verifyCustomer } from "../middlewares/validateAuthToken.js";

// Crear una instancia del enrutador de Express
const router = express.Router();

// Rutas para clientes
// GET /conversation/:clientId - Obtener o crear conversación del cliente autenticado
router.get("/conversation/:clientId", verifyCustomer, chatController.getOrCreateConversation);

// POST /message - Enviar un mensaje (cliente o admin)
router.post("/message", verifyToken, chatController.sendMessage);

// GET /messages/:conversationId - Obtener mensajes de una conversación
router.get("/messages/:conversationId", verifyToken, chatController.getMessages);

// PUT /read/:conversationId - Marcar mensajes como leídos
router.put("/read/:conversationId", verifyToken, chatController.markAsRead);

// Rutas exclusivas para administradores
// GET /admin/conversations - Obtener todas las conversaciones (solo admin)
router.get("/admin/conversations", verifyAdmin, chatController.getAllConversations);

// GET /admin/conversation/:clientId - Obtener o crear conversación para un cliente específico (admin)
router.get("/admin/conversation/:clientId", verifyAdmin, chatController.getOrCreateConversation);

// PUT /admin/close/:conversationId - Cerrar conversación (solo admin)
router.put("/admin/close/:conversationId", verifyAdmin, chatController.closeConversation);

// GET /admin/stats - Obtener estadísticas de chat (solo admin)
router.get("/admin/stats", verifyAdmin, chatController.getChatStats);

// Exportar el enrutador para ser usado en la aplicación principal
export default router;