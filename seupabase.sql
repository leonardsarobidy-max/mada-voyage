# database.js - Configuration de la Base de Données

**backend/config/database.js**

```javascript
/**
 * =============================================
 * CONFIGURATION DE LA BASE DE DONNÉES
 * Supporte Supabase et MySQL (switchable)
 * =============================================
 */

require('dotenv').config();

// =============================================
// 1. CONFIGURATION SUPABASE (Recommandé)
// =============================================

const { createClient } = require('@supabase/supabase-js');

// Variables d'environnement Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vérification des variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Variables Supabase manquantes. Utilisation des valeurs par défaut.');
}

// Client Supabase (pour les opérations utilisateur avec RLS)
const supabase = createClient(
    supabaseUrl || 'https://your-project.supabase.co',
    supabaseAnonKey || 'your-anon-key'
);

// Client Supabase Admin (sans RLS pour les opérations serveur)
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;

// =============================================
// 2. CONFIGURATION MYSQL (Alternative)
// =============================================

const mysql = require('mysql2/promise');

// Variables d'environnement MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mada_voyage',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+00:00'
};

// Pool de connexions MySQL
let mysqlPool = null;
let mysqlConnection = null;

/**
 * Initialise la connexion MySQL
 */
async function initMySQL() {
    try {
        mysqlPool = mysql.createPool(dbConfig);
        
        // Tester la connexion
        const connection = await mysqlPool.getConnection();
        console.log('✅ MySQL connecté avec succès');
        connection.release();
        
        return mysqlPool;
    } catch (error) {
        console.error('❌ Erreur connexion MySQL:', error.message);
        throw error;
    }
}

/**
 * Exécute une requête MySQL
 */
async function mysqlQuery(sql, params = []) {
    if (!mysqlPool) {
        await initMySQL();
    }
    try {
        const [rows, fields] = await mysqlPool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('❌ Erreur MySQL query:', error.message);
        throw error;
    }
}

/**
 * Exécute une requête MySQL avec transaction
 */
async function mysqlTransaction(queries) {
    if (!mysqlPool) {
        await initMySQL();
    }
    
    const connection = await mysqlPool.getConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const query of queries) {
            const [rows] = await connection.execute(query.sql, query.params || []);
            results.push(rows);
        }
        
        await connection.commit();
        connection.release();
        return results;
    } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
    }
}

// =============================================
// 3. CONFIGURATION MONGODB (Optionnel)
// =============================================

// const mongoose = require('mongoose');
// 
// const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mada_voyage';
// 
// async function connectMongoDB() {
//     try {
//         await mongoose.connect(mongoURI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });
//         console.log('✅ MongoDB connecté avec succès');
//     } catch (error) {
//         console.error('❌ Erreur MongoDB:', error.message);
//         throw error;
//     }
// }

// =============================================
// 4. TYPE DE BASE DE DONNÉES ACTIVE
// =============================================

const DB_TYPE = process.env.DB_TYPE || 'supabase'; // 'supabase', 'mysql', 'mongodb'

/**
 * Obtient le client de base de données actif
 */
function getDB() {
    switch (DB_TYPE) {
        case 'supabase':
            return supabase;
        case 'mysql':
            return { pool: mysqlPool, query: mysqlQuery, transaction: mysqlTransaction };
        // case 'mongodb':
        //     return mongoose;
        default:
            return supabase;
    }
}

// =============================================
// 5. FONCTIONS UTILITAIRES
// =============================================

/**
 * Vérifie la connexion à la base de données
 */
async function checkConnection() {
    try {
        switch (DB_TYPE) {
            case 'supabase':
                const { data, error } = await supabase
                    .from('users')
                    .select('count', { count: 'exact', head: true });
                if (error) throw error;
                return { status: 'connected', type: 'supabase' };
                
            case 'mysql':
                await mysqlQuery('SELECT 1');
                return { status: 'connected', type: 'mysql' };
                
            default:
                return { status: 'unknown', type: DB_TYPE };
        }
    } catch (error) {
        return { status: 'error', type: DB_TYPE, error: error.message };
    }
}

/**
 * Obtient les informations de la base de données
 */
async function getDBInfo() {
    const info = {
        type: DB_TYPE,
        status: 'unknown',
        tables: []
    };

    try {
        switch (DB_TYPE) {
            case 'supabase':
                const { data: tables, error } = await supabase
                    .from('information_schema.tables')
                    .select('table_name')
                    .eq('table_schema', 'public');
                    
                if (error) throw error;
                info.status = 'connected';
                info.tables = tables?.map(t => t.table_name) || [];
                break;
                
            case 'mysql':
                const rows = await mysqlQuery('SHOW TABLES');
                info.status = 'connected';
                info.tables = rows.map(row => Object.values(row)[0]);
                break;
        }
    } catch (error) {
        info.status = 'error';
        info.error = error.message;
    }

    return info;
}

/**
 * Formate les données pour la réponse
 */
function formatData(data) {
    if (!data) return null;
    if (Array.isArray(data)) {
        return data.map(item => formatData(item));
    }
    // Convertir les dates
    if (data instanceof Date) {
        return data.toISOString();
    }
    // Gérer les objets
    if (typeof data === 'object' && data !== null) {
        const formatted = {};
        for (const [key, value] of Object.entries(data)) {
            formatted[key] = formatData(value);
        }
        return formatted;
    }
    return data;
}

/**
 * Gère les erreurs de base de données
 */
function handleDBError(error) {
    console.error('Database Error:', error);
    
    // Erreurs Supabase
    if (error.code === 'PGRST116') {
        return { code: 'NOT_FOUND', message: 'Ressource non trouvée' };
    }
    if (error.code === '23505') {
        return { code: 'DUPLICATE', message: 'Cette valeur existe déjà' };
    }
    if (error.code === '23503') {
        return { code: 'FOREIGN_KEY', message: 'Violation de clé étrangère' };
    }
    
    // Erreurs MySQL
    if (error.code === 'ER_DUP_ENTRY') {
        return { code: 'DUPLICATE', message: 'Cette valeur existe déjà' };
    }
    if (error.code === 'ER_NO_REFERENCED_ROW') {
        return { code: 'FOREIGN_KEY', message: 'Référence invalide' };
    }
    
    return { code: 'UNKNOWN', message: error.message };
}

// =============================================
// 6. EXPORTATION
// =============================================

module.exports = {
    // Clients
    supabase,
    supabaseAdmin,
    mysqlPool,
    
    // Fonctions MySQL
    mysqlQuery,
    mysqlTransaction,
    initMySQL,
    
    // Fonctions utilitaires
    getDB,
    checkConnection,
    getDBInfo,
    formatData,
    handleDBError,
    
    // Configuration
    DB_TYPE,
    dbConfig,
    
    // Pour compatibilité avec l'ancien code
    query: mysqlQuery,
    pool: mysqlPool
};

// =============================================
// 7. INITIALISATION AUTOMATIQUE
// =============================================

// Initialiser MySQL si configuré
if (DB_TYPE === 'mysql') {
    initMySQL().catch(console.error);
}

console.log(`📊 Base de données: ${DB_TYPE.toUpperCase()}`);
console.log(`🔗 URL: ${DB_TYPE === 'supabase' ? supabaseUrl : dbConfig.host}`);

// =============================================
// 8. EXPORT POUR LES MODELS
// =============================================

/**
 * Query builder pour Supabase
 */
const supabaseQuery = (table) => {
    return {
        select: (columns = '*') => supabase.from(table).select(columns),
        insert: (data) => supabase.from(table).insert(data),
        update: (data) => supabase.from(table).update(data),
        delete: () => supabase.from(table).delete(),
        eq: (column, value) => supabase.from(table).select('*').eq(column, value),
        single: () => supabase.from(table).select('*').single()
    };
};

/**
 * Query builder pour MySQL
 */
const mysqlQueryBuilder = (table) => {
    return {
        select: async (columns = '*', where = null) => {
            let sql = `SELECT ${columns} FROM ${table}`;
            if (where) {
                const conditions = Object.entries(where)
                    .map(([key, value]) => `${key} = ?`)
                    .join(' AND ');
                sql += ` WHERE ${conditions}`;
                return mysqlQuery(sql, Object.values(where));
            }
            return mysqlQuery(sql);
        },
        insert: async (data) => {
            const columns = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
            return mysqlQuery(sql, Object.values(data));
        },
        update: async (data, where) => {
            const setClause = Object.keys(data)
                .map(key => `${key} = ?`)
                .join(', ');
            const whereClause = Object.keys(where)
                .map(key => `${key} = ?`)
                .join(' AND ');
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            return mysqlQuery(sql, [...Object.values(data), ...Object.values(where)]);
        },
        delete: async (where) => {
            const whereClause = Object.keys(where)
                .map(key => `${key} = ?`)
                .join(' AND ');
            const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
            return mysqlQuery(sql, Object.values(where));
        }
    };
};

module.exports.supabaseQuery = supabaseQuery;
module.exports.mysqlQueryBuilder = mysqlQueryBuilder;
```

---

## 📄 .env (Variables d'environnement)

```env
# =============================================
# BASE DE DONNÉES - SUPABASE (Recommandé)
# =============================================
DB_TYPE=supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =============================================
# BASE DE DONNÉES - MYSQL (Alternative)
# =============================================
# DB_TYPE=mysql
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=
# DB_NAME=mada_voyage
# DB_PORT=3306
# DB_POOL_SIZE=10

# =============================================
# JWT
# =============================================
JWT_SECRET=votre_secret_jwt_ultra_securise_123456789

# =============================================
# SERVER
# =============================================
PORT=3000
NODE_ENV=development
```

---

## 📊 Utilisation dans les Routes

### Avec Supabase
```javascript
// Dans authRoutes.js
const supabase = require('../config/database');

// Requête simple
const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

// Insertion
const { data, error } = await supabase
    .from('users')
    .insert([{ email, password, nom }])
    .select()
    .single();
```

### Avec MySQL
```javascript
// Dans authRoutes.js
const { mysqlQuery } = require('../config/database');

// Requête simple
const users = await mysqlQuery(
    'SELECT * FROM users WHERE email = ?',
    [email]
);

// Insertion
const result = await mysqlQuery(
    'INSERT INTO users (email, password, nom) VALUES (?, ?, ?)',
    [email, hashedPassword, nom]
);
```

### Avec Query Builder MySQL
```javascript
// Dans authRoutes.js
const { mysqlQueryBuilder } = require('../config/database');

const usersTable = mysqlQueryBuilder('users');

// SELECT
const users = await usersTable.select('*', { email: email });

// INSERT
const result = await usersTable.insert({ 
    email, 
    password: hashedPassword, 
    nom 
});

// UPDATE
const result = await usersTable.update(
    { password: newPassword },
    { id: userId }
);

// DELETE
const result = await usersTable.delete({ id: userId });
```

---

## 🛠️ Fonctions Utilitaires

### Vérification de connexion
```javascript
const { checkConnection, getDBInfo } = require('../config/database');

// Vérifier la connexion
const status = await checkConnection();
console.log('DB Status:', status);

// Obtenir les infos
const info = await getDBInfo();
console.log('Tables:', info.tables);
```

### Gestion d'erreurs
```javascript
const { handleDBError } = require('../config/database');

try {
    // Requête
} catch (error) {
    const formattedError = handleDBError(error);
    // { code: 'DUPLICATE', message: 'Cette valeur existe déjà' }
}
```

---

## 📋 Résumé des Fonctionnalités

| Fonction | Description |
|----------|-------------|
| **supabase** | Client Supabase principal (avec RLS) |
| **supabaseAdmin** | Client Supabase admin (sans RLS) |
| **mysqlPool** | Pool de connexions MySQL |
| **mysqlQuery** | Exécute une requête MySQL |
| **mysqlTransaction** | Exécute des requêtes en transaction |
| **initMySQL** | Initialise la connexion MySQL |
| **getDB** | Obtient le client actif |
| **checkConnection** | Vérifie la connexion |
| **getDBInfo** | Obtient les informations de la DB |
| **formatData** | Formate les données pour la réponse |
| **handleDBError** | Gère les erreurs de DB |
| **supabaseQuery** | Query builder pour Supabase |
| **mysqlQueryBuilder** | Query builder pour MySQL |

---

## 🔄 Switch entre Supabase et MySQL

Pour changer de base de données, modifiez simplement `DB_TYPE` dans `.env` :

```env
# Utiliser Supabase
DB_TYPE=supabase

# Utiliser MySQL
DB_TYPE=mysql
```

Toutes les routes utiliseront automatiquement la base de données configurée.