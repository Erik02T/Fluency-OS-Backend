import { applyDecorators, Type } from '@nestjs/common';
import { ApiBody, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export function ApiProgressBody<T extends { action: 'study' | 'review' }>(
  dto: Type<T>,
  reviewFields: readonly Exclude<Extract<keyof T, string>, 'action'>[],
) {
  const actionSchema = (action: T['action']) => ({
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      action: { type: 'string', enum: [action] },
      // The study path accepts these fields and ignores their values.
      ...Object.fromEntries(reviewFields.map((field) => [field, {}])),
    },
    required: action === 'review' ? ['action', ...reviewFields] : ['action'],
  });

  return applyDecorators(
    ApiExtraModels(dto),
    ApiBody({
      schema: {
        oneOf: [
          actionSchema('study'),
          {
            allOf: [{ $ref: getSchemaPath(dto) }, actionSchema('review')],
          },
        ],
      },
    }),
  );
}
