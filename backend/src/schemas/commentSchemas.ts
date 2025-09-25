import Joi from "joi";

export const createCommentSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  postId: Joi.number().integer().positive().required(),
  parentId: Joi.number().integer().positive().optional(),
});