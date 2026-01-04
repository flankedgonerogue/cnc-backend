declare module '@nestjs/mapped-types' {
  type Type<T> = new (...args: any[]) => T;

  export function PartialType<T>(classRef: Type<T>): Type<Partial<T>>;
}
