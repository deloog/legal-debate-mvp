import { NextRequest } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/api-error";

/**
 * 验证请求体
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Request body validation failed", {
        validationErrors: error.issues,
      });
    }
    throw new ValidationError("Invalid JSON in request body");
  }
}

/**
 * 验证查询参数
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): T {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string | string[]> = {};

    // 将查询参数转换为对象
    searchParams.forEach((value, key) => {
      if (params[key]) {
        // 如果键已存在，转换为数组
        if (Array.isArray(params[key])) {
          params[key].push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    });

    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Query parameters validation failed", {
        validationErrors: error.issues,
      });
    }
    throw new ValidationError("Invalid query parameters");
  }
}

/**
 * 验证路径参数
 */
export function validatePathParams<T>(
  params: Record<string, unknown>,
  schema: ZodSchema<T>,
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Path parameters validation failed", {
        validationErrors: error.issues,
      });
    }
    throw new ValidationError("Invalid path parameters");
  }
}

/**
 * 验证单个路径参数
 */
export function validatePathParam<T>(param: unknown, schema: ZodSchema<T>): T {
  try {
    return schema.parse(param);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Path parameter validation failed", {
        validationErrors: error.issues,
      });
    }
    throw new ValidationError("Invalid path parameter");
  }
}

/**
 * 验证中间件工厂函数
 */
export function validateRequest(
  bodySchema?: ZodSchema,
  querySchema?: ZodSchema,
  pathSchema?: ZodSchema,
) {
  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const result: {
      body?: any;
      query?: any;
      params?: any;
    } = {};

    // 验证请求体
    if (bodySchema) {
      result.body = await validateRequestBody(request, bodySchema);
    }

    // 验证查询参数
    if (querySchema) {
      result.query = validateQueryParams(request, querySchema);
    }

    // 验证路径参数
    if (pathSchema && context?.params) {
      result.params = validatePathParams(context.params, pathSchema);
    }

    return result;
  };
}
