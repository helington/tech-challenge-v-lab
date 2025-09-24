import { Response } from 'express';
import { Op, Sequelize } from 'sequelize';
import { Post, User, Comment, Like } from '../models';
import { AuthenticatedRequest, CreatePostRequest, UpdatePostRequest, PostQuery } from '../types';

export const getPosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      search,
      tags,
      authorId,
    }: PostQuery = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause: any = {
      isPublished: true,
    };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      whereClause.tags = {
        [Op.overlap]: tagArray,
      };
    }

    if (authorId) {
      whereClause.authorId = parseInt(authorId);
    }

    // posts query with eager loading
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
        [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", Sequelize.col("likes.id"))), "likesCount"],
        [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT",Sequelize.col("comments.id"))), "commentsCount"],

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
      group: [
        "Post.id",
        "author.id"
      ],
    });

    res.status(200).json({
      posts: posts,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(posts.length / limitNumber),
        totalItems: posts.length,
        hasNextPage: pageNumber < Math.ceil(posts.length / limitNumber),
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPostById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(parseInt(id), {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
        },
      ],
    });

    if (!post || !post.isPublished) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    const commentsWithAuthors = await post.getCommentsWithAuthors();
    
    const likeCount = await Like.count({ where: { postId: post.id } });
    const isLiked = req.user 
      ? await Like.findOne({ where: { postId: post.id, userId: req.user.id } }) !== null
      : false;

    res.status(200).json({
      post: {
        ...post.toJSON(),
        comments: commentsWithAuthors,
        likeCount,
        isLiked,
      },
    });
  } catch (error) {
    console.error('Get post by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { title, content, excerpt, imageUrl, tags }: CreatePostRequest = req.body;

    const post = await Post.create({
      title,
      content,
      excerpt,
      imageUrl,
      tags: tags || [],
      authorId: req.user.id,
      isPublished: true,
      publishedAt: new Date(),
    });

    const createdPost = await Post.findByPk(post.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
    });

    res.status(201).json({
      message: 'Post created successfully',
      post: createdPost,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const { title, content, excerpt, imageUrl, tags }: UpdatePostRequest = req.body;

    const post = await Post.findByPk(parseInt(id));
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is the author
    if (post.authorId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized to update this post' });
      return;
    }

    await post.update({
      title,
      content,
      excerpt,
      imageUrl,
      tags,
    });

    const updatedPost = await Post.findByPk(post.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar'],
        },
      ],
    });

    res.status(200).json({
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const post = await Post.findByPk(parseInt(id));
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is the author
    if (post.authorId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized to delete this post' });
      return;
    }

    await post.destroy();

    res.status(200).json({
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const likePost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;

    const post = await Post.findByPk(parseInt(id));
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const existingLike = await Like.findOne({
      where: { postId: post.id, userId: req.user.id },
    });

    if (existingLike) {
      await existingLike.destroy();
      res.status(200).json({ message: 'Post unliked', liked: false });
    } else {
      await Like.create({ postId: post.id, userId: req.user.id });
      res.status(200).json({ message: 'Post liked', liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};