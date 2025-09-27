# 🔧 Soluções Implementadas - Helington Willamy

## 📊 Resumo das Correções

- ✅ **N+1 Queries**: Implementado eager loading no postController
- ✅ **Testes Quebrados**: Corrigidas 2 assertions incorretas
- ✅ **Segurança**: Implementado Refresh Token e expiração de tokens JWT
- ✅ **Validações**: Implementadas validações de input robustas
- ✅ **Docker Inseguro**: Adicionados secrets e health checks

## 🚀 Performance - Antes vs Depois

### N+1 Query Problem (postController.ts e Post.ts)

**Antes**: 50 posts = 150+ queries

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

**Depois**: 50 posts = 1 query otimizada

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

**Antes**: Teste falhava, pois a asserção estava errada

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

**Depois**: Teste passando corretamente, com a asserção correta

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

### Refresh token (authSchemas.ts e commentSchemas.ts)

**Antes**: o sistema estava sem validações de inputs para os endpoints de 'updateComent' e 'updateProfile'

**Depois**: implementadas validações para o endpoints citados

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

**Antes**: Havia senhas em texto plano, estava com ausência de health checks, além da ausência de restart policies

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

**Depois**: Implementadas configurações com 'secrets', health checks e restart policies

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  aws_access_key:
    file: ./secrets/aws_access_key.txt
  aws_secret_key:
    file: ./secrets/aws_secret_key.txt
```

```yaml
backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: tech-challenge-backend
    secrets:
      - db_password
      - jwt_secret
      - aws_access_key
      - aws_secret_key
    environment:
      NODE_ENV: development
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: tech_challenge_blog
      DB_USER: admin
      DB_PASSWORD_FILE: /run/secrets/db_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      JWT_ACCESS_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 86400
      AWS_ACCESS_KEY_ID_FILE: /run/secrets/aws_access_key
      AWS_SECRET_ACCESS_KEY_FILE: /run/secrets/aws_secret_key
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
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

## 💭 Possíveis melhorias de arquitetura

- **Adição de camadas de abstração**: Observa-se que a camada de Controllers encontra-se um pouco sobrecarregada.
Essa camada deveria lidar apenas com requisições HTTP.
Para melhorar a organização, poderia-se adicionar uma camada de Services para concentrar as regras de negócio da aplicação. Além disso, uma camada de Repositories poderia ser criada para gerenciar diretamente a persistência de dados e as consultas ao banco, mantendo o controller mais limpo e focado apenas na orquestração das requisições e respostas.

- **Arquitetura em monolíto modular**: Em vez de organizar as pastas da API por tipo de funcionalidade (ex.: controllers, schemas, routes), poderia-se organizar os módulos por domínio (ex.: post, auth, comment), em que cada módulo conteria suas próprias camadas e funcionalidades agrupadas.
Essa organização facilita a manutenção do código, além de proporcionar maior clareza e separação de responsabilidades.