const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seed de la base de datos...');

    // Crear tenant de prueba
    const tenantQuery = `
      INSERT INTO tenants (name, nit, address, phone, email)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        nit = EXCLUDED.nit,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        updated_at = NOW()
      RETURNING id
    `;
    
    const tenantResult = await pool.query(tenantQuery, [
      'Restaurante Sr. Luis',
      '900.123.456-7',
      'Calle 123 #45-67, Bogotá',
      '300-123-4567',
      'info@srluis.com'
    ]);
    
    const tenantId = tenantResult.rows[0].id;
    console.log('✅ Tenant creado:', tenantId);

    // Crear usuario de prueba
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const userQuery = `
      INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE SET
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, username, email, role
    `;
    
    const userResult = await pool.query(userQuery, [
      tenantId,
      'admin',
      'admin@srluis.com',
      hashedPassword,
      'Administrador',
      'Sistema',
      'admin'
    ]);
    
    console.log('✅ Usuario creado:', userResult.rows[0]);

    // Crear algunos pedidos de prueba (comentado por ahora)
    console.log('✅ Pedidos de prueba omitidos - tabla orders necesita configuración');
    


    console.log('🎉 Seed completado exitosamente!');
    console.log('\n📋 Credenciales de prueba:');
    console.log('   Username: admin');
    console.log('   Email: admin@srluis.com');
    console.log('   Password: 123456');
    console.log('   Rol: admin');

  } catch (error) {
    console.error('❌ Error en seed:', error);
  } finally {
    await pool.end();
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase; 