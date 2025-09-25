import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'tech_challenge_blog',
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || require("fs").readFileSync(process.env.DB_PASSWORD_FILE, "utf8").trim(),
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // Intentional performance issue: missing connection pool optimization
  dialectOptions: {
    // Missing SSL configuration for production
    ...(process.env.NODE_ENV === 'production' && {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    })
  }
});

export { sequelize };