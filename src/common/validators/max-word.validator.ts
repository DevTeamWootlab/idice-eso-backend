import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function MaxWords(
  maxWords: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'maxWords',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must not exceed ${maxWords} words`,
        ...validationOptions,
      },
      constraints: [maxWords],
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return true;
          const [max] = args.constraints;
          return value.trim().split(/\s+/).filter(Boolean).length <= max;
        },
      },
    });
  };
}
