# 🔧 Soluções Implementadas - Helington Willamy

## 📊 Resumo das Correções

- ✅ **N+1 Queries**: Implementado eager loading no postController
- ✅ **Testes Quebrados**: Corrigidas 2 assertions incorretas
- ✅ **Segurança**: Implementado Refresh Token e expiração de tokens JWT
- ✅ **Validações**: Implementadas validações de input robustas

## 🚀 Performance - Antes vs Depois

### N+1 Query Problem (postController.ts)

**Antes**: 50 posts = 150+ queries

```javascript
// Código problemático encontrado
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

**Depois**: 50 posts = 1 query otimizada

```javascript
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

**Depois** implementadas validações para o endpoints citados

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
