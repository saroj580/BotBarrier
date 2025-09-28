import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&#)',
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters'
  });

const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .max(254)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email address is too long'
  });

export const signupSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 100 characters',
      'any.required': 'Name is required'
    }),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match'
    })
});

export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string()
    .optional()
    .allow('')
});


