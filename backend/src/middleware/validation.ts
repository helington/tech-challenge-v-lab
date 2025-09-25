import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      res.status(400).json({ 
        error: 'Validation error',
        message: errorMessage,
        details: error.details 
      });
      return;
    }
    
    next();
  };
};