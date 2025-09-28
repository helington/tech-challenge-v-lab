# 🔧 Soluções Implementadas - Helington Willamy

## 📊 Resumo das Correções

- ✅ **N+1 Queries**: Eager loading implementado no postController e no método Post.getCommentsWithAuthors().
- ✅ **Testes Quebrados**: Corrigidas as asserções incorretas nos testes de autenticação.
- ✅ **Segurança**: Implementado Refresh Token e expiração de tokens JWT
- ✅ **Validações**: Implementadas validações de input robustas
- ✅ **Docker Inseguro**: Senhas movidas para secrets, health checks adicionados e restart policies configuradas.

## 🚀 Performance - Antes vs Depois

### N+1 Query Problem (postController.ts e Post.ts)

**Antes**: 50 posts geravam 150+ queries, impactando a performance.

```javascript
// Código problemático em postController.ts
const posts = await Post.findAndCountAll({
  where: whereClause,
  limit: limitNumber,
  offset,
  order: [[sortBy, sortOrder]],
  include: [
    {
      model: User,
      as: "author",
      attributes: ["id", "username", "avatar"],
    },
  ],
});

const postsWithCounts = await Promise.all(
  posts.rows.map(async (post) => {
    const commentCount = await Comment.count({ where: { postId: post.id } });
    const likeCount = await Like.count({ where: { postId: post.id } });
    const isLiked = req.user
      ? (await Like.findOne({
          where: { postId: post.id, userId: req.user.id },
        })) !== null
      : false;

    return {
      ...post.toJSON(),
      commentCount,
      likeCount,
      isLiked,
    };
  })
);
```

```javascript
// Código problemático em Post.ts
public async getCommentsWithAuthors(): Promise<any[]> {
  const comments = await this.getComments();
  const commentsWithAuthors = [];

  for (const comment of comments) {
    const author = await comment.getAuthor();
    commentsWithAuthors.push({
      ...comment.toJSON(),
      author: author.toJSON()
    });
  }

  return commentsWithAuthors;
}
```

**Depois**: 50 posts resolvidos em uma única query otimizada.

```javascript
// Solução implementada em postController.ts
const userId = req.user?.id ?? -1;
const posts = await Post.findAll({
  subQuery: false,
  where: whereClause,
  limit: limitNumber,
  offset,
  order: [[sortBy, sortOrder]],
  attributes: [
    "id",
    "title",
    "createdAt",

    // Like and comments counting
    [
      Sequelize.fn(
        "COUNT",
        Sequelize.fn("DISTINCT", Sequelize.col("likes.id"))
      ),
      "likesCount",
    ],
    [
      Sequelize.fn(
        "COUNT",
        Sequelize.fn("DISTINCT", Sequelize.col("comments.id"))
      ),
      "commentsCount",
    ],

    // Is_liked indicator
    [
      Sequelize.literal(
        `CASE WHEN COUNT(CASE WHEN likes."userId" = ${userId} THEN 1 END) > 0 THEN TRUE ELSE FALSE END`
      ),
      "is_liked",
    ],
  ],
  include: [
    {
      model: User,
      as: "author",
      attributes: ["id", "username", "avatar"],
    },
    {
      model: Like,
      as: "likes",
      attributes: [],
    },
    {
      model: Comment,
      as: "comments",
      attributes: [],
    },
  ],
  group: ["Post.id", "author.id"],
});
```

```javascript
// Solução implementada em Post.ts
public async getCommentsWithAuthors(): Promise<any[]> {
  const commentsWithAuthors = await this.getComments({
    include: [
      {
        model: User,
        as: "author"
      }
    ]
  });

  return commentsWithAuthors;
}
```

## 🧪 Testes - Antes vs Depois

### Asserções incorretas (auth.test.ts)

**Antes**: Testes falhando devido a asserções incorretas.

```javascript
it("should fail - broken test example", async () => {
  const userData = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
  };

  const user = await User.create(userData);

  // This test will fail because we're expecting the wrong value
  expect(user.username).toBe("wrongusername");
});
```
```javascript
it('should fail - broken JWT test', () => {
  const payload = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
  };

  const token = generateToken(payload);
  
  // This will fail because we're expecting undefined
  expect(token).toBeUndefined();
});
```

**Depois**: Testes corrigidos e funcionando corretamente.

```javascript
it("should create user with correct username", async () => {
  const userData = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
  };

  const user = await User.create(userData);

  expect(user.username).toBe("testuser");
});
```
```javascript
it('should generate defined token', () => {
  const payload = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
  };

  const token = generateToken(payload);
  
  expect(token).toBeDefined();
});
```

## 🔒 Segurança

### Refresh token (authController.ts)

**Antes**: O sistema utilizava apenas access tokens com tempo de expiração. Quando o token expirava, o cliente precisava reenviar as credenciais do usuário (e-mail/senha) para obter um novo token. Esse processo aumentava a exposição das credenciais na rede, representando um risco de segurança.

**Depois**: implementado um fluxo de refresh token armazenado em cookies HTTP-Only. Dessa forma, as credenciais do usuário não transitam mais repetidamente pelo sistema, reduzindo significativamente a superfície de ataque.

```javascript
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  
  try {
    const refreshToken = req.cookies.refreshToken;
  
    // No token provided in cookies
    if(!refreshToken) {
      res.status(401).json({ error: "Access Denied. No refresh token provided."});
      return
    }

    const validRefreshToken = await RefreshToken.findOne({
      where: {
        token: refreshToken
      }
    });

    // Token doens't exist
    if (!validRefreshToken) {
      res.status(400).json({ error: "Invalid refresh token!" });
      return;
    }

    // Token is expired
    if (verifyRefreshTokenExpiration(validRefreshToken)) {

      // Delete expired refresh token
      await validRefreshToken.destroy();
      res.status(403).json({ error: "Refresh token was expired!" });
      return
    }

    const owner = await User.findByPk(validRefreshToken.ownerId) as User;

    // Generate access token
    const accessToken = generateToken({
      id: owner.id,
      email: owner.email,
      username: owner.username
    });

    // Generate refresh token
    const newRefreshToken = await RefreshToken.create({
      ownerId: owner.id,
      expiresAt: new Date(Date.now() + JWT_REFRESH_EXPIRES_IN * 1000),
    });

    // Revoke used refresh token
    await validRefreshToken.destroy();

    res
      .cookie("refreshToken", newRefreshToken.token, {
        httpOnly: true,
        sameSite: 'strict',
      })
      .status(200)
      .json({
        message: "Refresh token successful",
        accessToken,
      });

  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
```

## 🔐 Validações

### Falta de validações de inputs para certos endpoints (authSchemas.ts e commentSchemas.ts)

**Antes**: Ausência de validações de inputs para os endpoints de updateComent e updateProfile.

**Depois**: implementadas validações para o endpoints citados.

```javascript
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  avatar: Joi.string().uri().optional(),
});
```

```javascript
export const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
});
```

## 🐳 Docker

### Docker com configuração insegura (docker-compose.yml)

**Antes**: Senhas em texto plano, health check ausente, volumes incorretos e sem restart policies.

```yaml
postgres:
  postgres:
    image: postgres:15-alpine
    container_name: tech-challenge-db
    environment:
      POSTGRES_DB: tech_challenge_blog
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - tech-challenge-network
```
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: tech-challenge-backend
  environment:
    NODE_ENV: development
    DB_HOST: postgres
    DB_PORT: 5432
    DB_NAME: tech_challenge_blog
    DB_USER: admin
    DB_PASSWORD: password123
    JWT_SECRET: your-super-secret-jwt-key-here
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    AWS_S3_BUCKET: ${AWS_S3_BUCKET}
    AWS_REGION: ${AWS_REGION:-us-east-1}
  ports:
    - "3001:3001"
  depends_on:
    - postgres
  volumes:
    - ./backend:/app
    - /app/node_modules
  networks:
    - tech-challenge-network
```
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  container_name: tech-challenge-frontend
  environment:
    REACT_APP_API_URL: http://localhost:3001
  ports:
    - "3000:3000"
  depends_on:
    - backend
  volumes:
    - ./frontend:/app
    - /app/node_modules
  networks:
    - tech-challenge-network
```


**Depois**:
- Senha do banco de dados movida para secrets.
- Utilização das variaveis de ambiente pelo serviço de backend.
- Health check configurado no Postgres.
- Restart policies adicionadas em todos os serviços.
- Volume do frontend corrigido para evitar perda da pasta build.


```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

```yaml
postgres:
  image: postgres:15-alpine
  container_name: tech-challenge-db
  secrets:
    - db_password
  environment:
    POSTGRES_DB: tech_challenge_blog
    POSTGRES_USER: admin
    POSTGRES_PASSWORD_FILE: /run/secrets/db_password
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "pg_isready", "-U", "admin"]
    interval: 30s
    timeout: 10s
    retries: 3
  ports:
    - "5433:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - tech-challenge-network
```
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: tech-challenge-backend
  environment:
    NODE_ENV: development
    DB_HOST: postgres
    DB_PORT: 5432
    DB_NAME: tech_challenge_blog
    DB_USER: admin
    DB_PASSWORD: ${DB_PASSWORD}
    JWT_SECRET_FILE: ${JWT_SECRET}
    JWT_ACCESS_EXPIRES_IN: 15m
    JWT_REFRESH_EXPIRES_IN: 86400
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    AWS_S3_BUCKET: tech-challenge-blog-vlab-helington
    AWS_REGION: sa-east-1
  ports:
    - "3001:3001"
  depends_on:
    - postgres
  volumes:
    - ./backend:/app
  networks:
    - tech-challenge-network
  restart: on-failure
```
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  container_name: tech-challenge-frontend
  environment:
    REACT_APP_API_URL: http://localhost:3001/api
  restart: on-failure
  ports:
    - "3000:3000"
  depends_on:
    - backend
  volumes:
    - /app/node_modules
  networks:
    - tech-challenge-network
```

## 💭 Possíveis melhorias de arquitetura

- **Adição de camadas de abstração**: Observa-se que a camada de Controllers encontra-se um pouco sobrecarregada.
Essa camada deveria lidar apenas com requisições HTTP.
Para melhorar a organização, poderia-se adicionar uma camada de Services para concentrar as regras de negócio da aplicação. Além disso, uma camada de Repositories poderia ser criada para gerenciar diretamente a persistência de dados e as consultas ao banco, mantendo o controller mais limpo e focado apenas na orquestração das requisições e respostas.

- **Arquitetura em monolíto modular**: Em vez de organizar as pastas da API por tipo de funcionalidade (ex.: controllers, schemas, routes), poderia-se organizar os módulos por domínio (ex.: post, auth, comment), em que cada módulo conteria suas próprias camadas e funcionalidades agrupadas.
Essa organização facilita a manutenção do código, além de proporcionar maior clareza e separação de responsabilidades.