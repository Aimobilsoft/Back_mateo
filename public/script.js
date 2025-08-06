// Configuración de la API
const API_BASE_URL = 'http://localhost:3001/api';
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Elementos del DOM
const elements = {
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    orderForm: document.getElementById('orderForm'),
    loginSection: document.getElementById('loginSection'),
    registerSection: document.getElementById('registerSection'),
    ordersSection: document.getElementById('ordersSection'),
    orderModal: document.getElementById('orderModal'),
    ordersList: document.getElementById('ordersList'),
    createOrderBtn: document.getElementById('createOrderBtn'),
    refreshOrdersBtn: document.getElementById('refreshOrdersBtn'),
    apiStatus: document.getElementById('apiStatus'),
    userStatus: document.getElementById('userStatus'),
    closeModal: document.querySelector('.close')
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkApiStatus();
});

// Configurar event listeners
function setupEventListeners() {
    // Login
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // Registro
    elements.registerForm.addEventListener('submit', handleRegister);
    
    // Pedidos
    elements.createOrderBtn.addEventListener('click', showOrderModal);
    elements.refreshOrdersBtn.addEventListener('click', loadOrders);
    elements.orderForm.addEventListener('submit', handleCreateOrder);
    
    // Modal
    elements.closeModal.addEventListener('click', hideOrderModal);
    window.addEventListener('click', function(event) {
        if (event.target === elements.orderModal) {
            hideOrderModal();
        }
    });
}

// Inicializar la aplicación
function initializeApp() {
    if (authToken) {
        // Verificar si el token sigue siendo válido
        verifyToken();
    } else {
        showLoginSection();
    }
}

// Verificar estado de la API
async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            updateApiStatus('Conectado', 'connected');
        } else {
            updateApiStatus('Error', 'disconnected');
        }
    } catch (error) {
        updateApiStatus('Desconectado', 'disconnected');
        console.error('Error checking API status:', error);
    }
}

// Actualizar estado de la API
function updateApiStatus(status, className) {
    elements.apiStatus.textContent = status;
    elements.apiStatus.className = `status-value ${className}`;
}

// Actualizar estado del usuario
function updateUserStatus(status, className = '') {
    elements.userStatus.textContent = status;
    elements.userStatus.className = `status-value ${className}`;
}

// Verificar token
async function verifyToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showOrdersSection();
            loadOrders();
            updateUserStatus(`${currentUser.name} (${currentUser.role})`, 'authenticated');
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showLoginSection();
            updateUserStatus('No autenticado');
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        showLoginSection();
        updateUserStatus('Error de conexión');
    }
}

// Manejar login
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            
            showOrdersSection();
            loadOrders();
            updateUserStatus(`${currentUser.name} (${currentUser.role})`, 'authenticated');
            
            // Limpiar formulario
            event.target.reset();
            
            showNotification('¡Login exitoso!', 'success');
        } else {
            showNotification(data.message || 'Error en el login', 'error');
        }
    } catch (error) {
        console.error('Error during login:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Manejar registro
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('¡Usuario registrado exitosamente!', 'success');
            event.target.reset();
        } else {
            showNotification(data.message || 'Error en el registro', 'error');
        }
    } catch (error) {
        console.error('Error during registration:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Cargar pedidos
async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            displayOrders(orders);
        } else {
            showNotification('Error al cargar pedidos', 'error');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Mostrar pedidos
function displayOrders(orders) {
    if (!orders || orders.length === 0) {
        elements.ordersList.innerHTML = '<p style="text-align: center; color: #718096; grid-column: 1 / -1;">No hay pedidos disponibles</p>';
        return;
    }
    
    elements.ordersList.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-id">Pedido #${order.id}</span>
                <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
            </div>
            <div class="order-details">
                <p><strong>Mesa:</strong> ${order.table}</p>
                <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
            </div>
            <div class="order-items">
                <h4>Items:</h4>
                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>$${item.price.toFixed(2)}</span>
                    </div>
                `).join('')}
                <div class="order-item" style="font-weight: bold; border-top: 2px solid #e2e8f0; margin-top: 10px;">
                    <span>Total:</span>
                    <span>$${calculateTotal(order.items).toFixed(2)}</span>
                </div>
            </div>
            <div class="order-actions">
                ${getOrderActions(order)}
            </div>
        </div>
    `).join('');
}

// Calcular total del pedido
function calculateTotal(items) {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Obtener texto del estado
function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'preparing': 'Preparando',
        'ready': 'Listo',
        'delivered': 'Entregado'
    };
    return statusMap[status] || status;
}

// Obtener acciones del pedido
function getOrderActions(order) {
    const actions = [];
    
    if (order.status === 'pending') {
        actions.push(`<button onclick="updateOrderStatus(${order.id}, 'preparing')" class="btn btn-primary">Preparar</button>`);
    }
    
    if (order.status === 'preparing') {
        actions.push(`<button onclick="updateOrderStatus(${order.id}, 'ready')" class="btn btn-success">Listo</button>`);
    }
    
    if (order.status === 'ready') {
        actions.push(`<button onclick="updateOrderStatus(${order.id}, 'delivered')" class="btn btn-secondary">Entregar</button>`);
    }
    
    actions.push(`<button onclick="deleteOrder(${order.id})" class="btn btn-danger">Eliminar</button>`);
    
    return actions.join('');
}

// Actualizar estado del pedido
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showNotification('Estado actualizado', 'success');
            loadOrders();
        } else {
            showNotification('Error al actualizar estado', 'error');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Eliminar pedido
async function deleteOrder(orderId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showNotification('Pedido eliminado', 'success');
            loadOrders();
        } else {
            showNotification('Error al eliminar pedido', 'error');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Mostrar modal de pedido
function showOrderModal() {
    elements.orderModal.classList.remove('hidden');
}

// Ocultar modal de pedido
function hideOrderModal() {
    elements.orderModal.classList.add('hidden');
    elements.orderForm.reset();
}

// Manejar creación de pedido
async function handleCreateOrder(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const orderData = {
        table: parseInt(formData.get('table')),
        items: JSON.parse(formData.get('items')),
        notes: formData.get('notes') || ''
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('¡Pedido creado exitosamente!', 'success');
            hideOrderModal();
            loadOrders();
        } else {
            showNotification(data.message || 'Error al crear pedido', 'error');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Mostrar sección de login
function showLoginSection() {
    elements.loginSection.classList.remove('hidden');
    elements.registerSection.classList.remove('hidden');
    elements.ordersSection.classList.add('hidden');
}

// Mostrar sección de pedidos
function showOrdersSection() {
    elements.loginSection.classList.add('hidden');
    elements.registerSection.classList.add('hidden');
    elements.ordersSection.classList.remove('hidden');
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Estilos de la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    // Colores según tipo
    const colors = {
        success: '#48bb78',
        error: '#f56565',
        info: '#4299e1'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Agregar estilos de animación para notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style); 