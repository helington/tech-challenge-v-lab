import { sequelize } from '../config/database';
import User from './User';
import Post from './Post';
import Comment from './Comment';
import Like from './Like';
import RefreshToken from './RefreshToken';

// User associations
User.hasMany(Post, {
  foreignKey: 'authorId',
  as: 'posts',
});

User.hasMany(Comment, {
  foreignKey: 'authorId',
  as: 'comments',
});

User.hasMany(Like, {
  foreignKey: 'userId',
  as: 'likes',
});

User.hasMany(RefreshToken, {
  foreignKey: 'ownerId',
  as: 'refreshTokens',
});

// Post associations
Post.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
});

Post.hasMany(Comment, {
  foreignKey: 'postId',
  as: 'comments',
});

Post.hasMany(Like, {
  foreignKey: 'postId',
  as: 'likes',
});

// Comment associations
Comment.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
});

Comment.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post',
});

Comment.belongsTo(Comment, {
  foreignKey: 'parentId',
  as: 'parent',
});

Comment.hasMany(Comment, {
  foreignKey: 'parentId',
  as: 'replies',
});

// Like associations
Like.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Like.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post',
});

// Refresh tokens associations
RefreshToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'owner',
});

export {
  sequelize,
  User,
  Post,
  Comment,
  Like,
  RefreshToken,
};

export default {
  sequelize,
  User,
  Post,
  Comment,
  Like,
  RefreshToken,
};