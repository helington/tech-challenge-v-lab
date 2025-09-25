import Joi from "joi";

export const registerSchema = Joi.object({
    username: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(255).required(),
    firstName: Joi.string().max(100).optional(),
    lastName: Joi.string().max(100).optional(),
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});