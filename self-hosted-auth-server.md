# Setting Up a Self-Hosted Authentication Server

This guide covers creating a dedicated authentication server using Express.js that your React application can communicate with, completely replacing Supabase Auth.

## 1. Create a New Express Project

First, create a new directory for your authentication server:

```bash
mkdir auth-server
cd auth-server
npm init -y
npm install express cors jsonwebtoken pg bcrypt cookie-parser dotenv
npm install --save-dev typescript @types/express @types/node @types/pg @types/bcrypt @types/jsonwebtoken @types/cookie-parser ts-node nodemon
```

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

## 2. Create Environment Variables

Create a `.env` file:

```
PORT=4000
JWT_SECRET=your-super-secret-key
DATABASE_URL=postgresql://wms_user:your_secure_password@localhost:5432/wms_db
CLIENT_ORIGIN=http://localhost:3000
```

## 3. Set Up Basic Server

Create the server structure:

```
/auth-server
  /src
    /config
      db.ts
      auth.ts
    /middleware
      auth.middleware.ts
    /routes
      auth.routes.ts
    /controllers
      auth.controller.ts
    /models
      user.model.ts
    app.ts
    server.ts
```

### src/config/db.ts

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Database connection successful');
  }
});

export default pool;
```

### src/config/auth.ts

```typescript
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
export const JWT_EXPIRES_IN = '24h';

export const generateToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
```

### src/middleware/auth.middleware.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/auth';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }

    next();
  };
};
```

### src/controllers/auth.controller.ts

```typescript
import { Request, Response } from 'express';
import db from '../config/db';
import { generateToken } from '../config/auth';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Step 1: Find user in auth.users
    const userResult = await db.query(
      'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }

    const user = userResult.rows[0];

    // Step 2: Verify password using pgcrypto
    const passwordCheckResult = await db.query(
      "SELECT encrypted_password = crypt($1, encrypted_password) as password_matches FROM auth.users WHERE id = $2",
      [password, user.id]
    );

    if (!passwordCheckResult.rows[0].password_matches) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }

    // Step 3: Get user details from public.users
    const userDetailsResult = await db.query(
      'SELECT id, email, role, full_name, is_active FROM public.users WHERE id = $1',
      [user.id]
    );

    if (userDetailsResult.rows.length === 0 || !userDetailsResult.rows[0].is_active) {
      return res.status(401).json({ message: 'User account not found or inactive' });
    }

    const userDetails = userDetailsResult.rows[0];

    // Step 4: Get staff details
    const staffResult = await db.query(
      'SELECT id, employee_id, department, position, permissions FROM public.staff WHERE id = $1',
      [user.id]
    );

    const staffDetails = staffResult.rows[0] || null;

    // Step 5: Update last sign in time
    await db.query(
      'UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: userDetails.role,
      permissions: staffDetails?.permissions || {}
    });

    // Set cookie for added security
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });

    // Return user data and token
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: userDetails.email,
        role: userDetails.role,
        full_name: userDetails.full_name,
      },
      staff: staffDetails
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.sub;

    const userResult = await db.query(
      `SELECT u.id, u.email, u.role, u.full_name, 
              s.employee_id, s.department, s.position, s.permissions
       FROM public.users u
       LEFT JOIN public.staff s ON u.id = s.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ profile: userResult.rows[0] });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  return res.status(200).json({ message: 'Logged out successfully' });
};
```

### src/routes/auth.routes.ts

```typescript
import { Router } from 'express';
import { login, getProfile, logout } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);
router.post('/logout', authenticateToken, logout);

export default router;
```

### src/app.ts

```typescript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

export default app;
```

### src/server.ts

```typescript
import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## 4. Configure Scripts

Update your `package.json` scripts:

```json
"scripts": {
  "start": "node dist/server.js",
  "dev": "nodemon src/server.ts",
  "build": "tsc",
  "watch": "tsc --watch"
}
```

## 5. Create Additional Endpoints (Optional)

### Additional API Endpoints (Optional)

You may want to add these additional endpoints:

```typescript
// Registration Endpoint
export const register = async (req: Request, res: Response) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Check if user already exists
    const userExists = await db.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Create user
    const newUserResult = await db.query(
      `INSERT INTO auth.users (
        email, 
        encrypted_password, 
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data
      ) VALUES (
        $1, 
        crypt($2, gen_salt('bf')), 
        NOW(),
        $3,
        $4
      ) RETURNING id`,
      [
        email, 
        password,
        JSON.stringify({ provider: 'email', providers: ['email'] }),
        JSON.stringify({ full_name: full_name || email.split('@')[0] })
      ]
    );

    const userId = newUserResult.rows[0].id;

    // Create public user
    await db.query(
      `INSERT INTO public.users (
        id, 
        email, 
        role, 
        full_name, 
        is_active
      ) VALUES ($1, $2, $3, $4, $5)`,
      [userId, email, 'user', full_name || email.split('@')[0], true]
    );

    return res.status(201).json({ 
      message: 'User registered successfully',
      userId
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Password Reset Request
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userResult = await db.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal that the user doesn't exist
      return res.status(200).json({ 
        message: 'If a user with this email exists, a password reset link has been sent' 
      });
    }

    const userId = userResult.rows[0].id;
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Store the reset token
    await db.query(
      `UPDATE auth.users 
       SET 
         recovery_token = $1,
         recovery_sent_at = $2
       WHERE id = $3`,
      [resetToken, resetExpires, userId]
    );

    // In a real application, you would send an email with the reset link
    console.log(`Password reset link: ${process.env.CLIENT_ORIGIN}/reset-password?token=${resetToken}`);

    return res.status(200).json({ 
      message: 'If a user with this email exists, a password reset link has been sent' 
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
```

Add these routes to your `auth.routes.ts`:

```typescript
router.post('/register', register);
router.post('/request-password-reset', requestPasswordReset);
```

## 6. Run the Server

Start your authentication server:

```bash
npm run dev
```

## 7. Connect Your React App

Update your React app to use this authentication server.

### Update the API client

In your React app, create or modify your API client (`src/lib/apiClient.ts`):

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true // Important for cookies
});

// Add a request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Update Auth Context

Update your authentication context to use the new API:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

// Your AuthContext implementation...

export const AuthProvider = ({ children }) => {
  // State and other logic...

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        setIsAuthenticated(true);
        setUser(response.data.user);
        setStaff(response.data.staff);
        return { success: true };
      }
      
      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Authentication failed';
      return { success: false, error: errorMessage };
    }
  };
  
  // Rest of your implementation...
};
```

## 8. Deploy with Docker (Optional)

Create a `Dockerfile` for the auth server:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

Create a `docker-compose.yml` file:

```yaml
version: '3'

services:
  auth-server:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - JWT_SECRET=your-super-secret-key
      - DATABASE_URL=postgresql://wms_user:your_secure_password@postgres:5432/wms_db
      - CLIENT_ORIGIN=http://localhost:3000
    depends_on:
      - postgres
    restart: always

  postgres:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=wms_user
      - POSTGRES_PASSWORD=your_secure_password
      - POSTGRES_DB=wms_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres-data:
```

Create an initialization script (`init.sql`) to set up the database:

```sql
-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables (same as in the database setup guide)
-- ...
```

## 9. Benefits of a Dedicated Auth Server

1. **Separation of Concerns**: Keep authentication logic separate from your frontend application.
2. **Enhanced Security**: Proper token handling, HTTP-only cookies, and centralized auth logic.
3. **Scalability**: The auth server can be scaled independently of your frontend.
4. **Cross-Platform Support**: The same auth server can serve multiple clients (web, mobile, etc.).
5. **Full Control**: Complete freedom to implement custom authentication flows.
6. **Monitoring**: Easier to monitor auth-related metrics and logs in isolation.

## 10. Troubleshooting

### CORS Issues
- Ensure your CORS settings match your frontend application's origin
- Double-check that credentials are enabled (both server and client)

### Token Issues
- Verify that the secret key is the same across environments
- Check token expiration settings

### Database Connection Issues
- Verify connection string parameters
- Ensure PostgreSQL is running and accessible
- Check database user permissions

### Request/Response Issues
- Use a tool like Postman to test API endpoints directly
- Check network tab in browser dev tools for detailed error messages 