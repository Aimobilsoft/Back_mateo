# 🍽️ Sistema de Pedidos Sr. Luis - Backend

Backend completo para sistema de gestión de pedidos multi-tenant desarrollado para el Sr. Luis.

## 🚀 Características

- ✅ **Multi-tenant**: Cada cliente/negocio aislado por tenant_id
- ✅ **Autenticación JWT**: Sistema seguro de login/logout
- ✅ **Roles y permisos**: admin, waiter, kitchen, cashier
- ✅ **Gestión de órdenes**: Crear, modificar, cerrar órdenes
- ✅ **Sistema de unidades**: Control granular por producto
- ✅ **Dashboard de cocina**: Vista especializada para cocineros
- ✅ **Validaciones robustas**: A nivel de base de datos y API
- ✅ **PostgreSQL**: Base de datos relacional con triggers

## 📋 Requisitos

- Node.js 16+
- PostgreSQL 12+
- npm o yarn

## 🛠️ Instalación

### 1. Clonar y instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp env.example .env

# Editar .env con tus credenciales de PostgreSQL
```

### 3. Configurar base de datos
```bash
# Ejecutar el script SQL en tu PostgreSQL
# (El script que te proporcionó Mateo)

# Poblar con datos de prueba
npm run db:seed
```

### 4. Iniciar servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔐 Autenticación

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

### Respuesta
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "tenant_id": 1,
    "username": "admin",
    "role": "admin",
    "first_name": "Administrador"
  }
}
```

## 📡 Endpoints Principales

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/register` - Registrar usuario
- `GET /auth/me` - Obtener perfil actual

### Órdenes
- `POST /orders` - Crear nueva orden
- `GET /orders` - Listar órdenes
- `GET /orders/:id` - Obtener orden específica
- `POST /orders/:id/items` - Agregar item a orden
- `PATCH /orders/:id/items/:itemId` - Modificar item
- `POST /orders/:id/items/:itemId/units` - Crear unidades
- `DELETE /orders/items/units/:unitId` - Eliminar unidad
- `PATCH /orders/items/units/:unitId` - Cambiar estado unidad
- `POST /orders/:id/close` - Cerrar orden
- `DELETE /orders/:id` - Eliminar orden

### Cocina
- `GET /kitchen/units?status=pending` - Unidades pendientes
- `PATCH /kitchen/units/:unitId/status` - Cambiar estado
- `GET /kitchen/dashboard` - Dashboard de cocina

## 👥 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso completo |
| `waiter` | Crear/modificar órdenes, gestionar mesas |
| `kitchen` | Ver unidades pendientes, cambiar estados |
| `cashier` | Cerrar órdenes, gestionar pagos |

## 🗄️ Estructura de Base de Datos

### Tablas Principales
- `tenants` - Clientes/negocios
- `users` - Usuarios del sistema
- `restaurant_tables` - Mesas del local
- `categories` - Categorías de productos
- `units` - Unidades de medida
- `products` - Productos del menú
- `orders` - Órdenes de pedidos
- `order_items` - Items de cada orden
- `order_item_units` - Unidades individuales
- `invoices` - Facturas
- `notifications` - Notificaciones

## 🔧 Configuración

### Variables de Entorno (.env)
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sistema_pedidos
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=tu_jwt_secret_super_seguro
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173
```

## 📊 Datos de Prueba

El script de seed crea:

- **1 Tenant**: "Restaurante El Buen Sabor"
- **4 Usuarios**: admin, mesero1, cocina1, caja1
- **5 Mesas**: Numeradas del 1 al 5
- **4 Categorías**: Entradas, Platos Principales, Bebidas, Postres
- **4 Unidades**: Unidad, Porción, Vaso, Plato
- **5 Productos**: Ensalada César, Hamburguesa, Pasta, Limonada, Tiramisú

### Credenciales de Prueba
```
Usuario: admin
Password: 123456
```

## 🧪 Testing

### Ejemplo de flujo completo

1. **Login**
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

2. **Crear orden**
```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_id":1,"customer_name":"Juan Pérez","type":"dine_in"}'
```

3. **Agregar item**
```bash
curl -X POST http://localhost:3001/orders/1/items \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2,"notes":"Sin cebolla"}'
```

## 🚀 Scripts Disponibles

```bash
npm run dev          # Desarrollo con nodemon
npm start           # Producción
npm run db:seed     # Poblar base de datos
```

## 📝 Notas Técnicas

- **Multi-tenant**: Todas las consultas filtran por `tenant_id`
- **Validaciones**: CHECK constraints en BD + validaciones en API
- **Seguridad**: JWT + bcrypt + helmet + CORS
- **Performance**: Índices en campos críticos
- **Logging**: Middleware de logging automático

## 🤝 Contribución

Desarrollado por Emmanuel para Mateo (frontend/móvil) del proyecto del Sr. Luis.

---

**¡Listo para usar! 🎉** 