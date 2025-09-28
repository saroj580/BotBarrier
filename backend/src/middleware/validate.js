import { ValidationError } from './errorHandler.js';

export function validate (schema, source = 'body') {
  return (req, res, next) => {
    let dataToValidate;
    let targetProperty;
    
    switch (source) {
      case 'body':
        dataToValidate = req.body;
        targetProperty = 'body';
        break;
      case 'query':
        dataToValidate = req.query;
        targetProperty = 'query';
        break;
      case 'params':
        dataToValidate = req.params;
        targetProperty = 'params';
        break;
      case 'headers':
        dataToValidate = req.headers;
        targetProperty = 'headers';
        break;
      default:
        dataToValidate = req.body;
        targetProperty = 'body';
    }
    
    const { error, value } = schema.validate(dataToValidate, { 
      abortEarly: false, 
      stripUnknown: true,
      allowUnknown: false
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      throw new ValidationError('Validation failed', details);
    }
    
    req[targetProperty] = value;
    next();
  };
}


