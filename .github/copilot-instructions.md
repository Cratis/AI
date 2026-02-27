# GitHub Copilot Instructions

## General

- Make only high confidence suggestions when reviewing code changes.
- Always use the latest version C#, currently C# 13 features.
- Never change global.json unless explicitly asked to.
- Never change package.json or package-lock.json files unless explicitly asked to.
- Never change NuGet.config files unless explicitly asked to.
- Never leave unused using statements in the code.
- Always ensure that the code compiles without warnings.
- Always ensure that the code passes all tests.
- Always ensure that the code adheres to the project's coding standards.
- Always ensure that the code is maintainable.
- Review Directory.Build.props and .editorconfig for all warnings configured as errors.
- Never generate code that would violate these warning settings.
- Always respect the project's nullable reference type settings.
- Always reuse the active terminal for commands.
- Do not create new terminals unless current one is busy or fails.

## Formatting

- Honor the existing code style and conventions in the project.
- Apply code-formatting style defined in .editorconfig.
- Prefer file-scoped namespace declarations and single-line using directives.
- Insert a new line before the opening curly brace of any code block (e.g., after `if`, `for`, `while`, `foreach`, `using`, `try`, etc.).
- Ensure that the final return statement of a method is on its own line.
- Use pattern matching and switch expressions wherever possible.
- Use `nameof` instead of string literals when referring to member names.
- Place private class declarations at the bottom of the file.

## C# Instructions

- Write clear and concise comments for each function.
- Prefer `var` over explicit types when declaring variables.
- Do not add unnecessary comments or documentation.
- Use `using` directives for namespaces at the top of the file.
- Sort the `using` directives alphabetically.
- Use namespaces that match the folder structure.
- Remove unused `using` directives.
- Use file-scoped namespace declarations.
- Use single-line using directives.
- For types that does not have an implementation, don't add a body (e.g., `public interface IMyInterface;`).
- Prefer using `record` types for immutable data structures.
- Use expression-bodied members for simple methods and properties.
- Use `async` and `await` for asynchronous programming.
- Use `Task` and `Task<T>` for asynchronous methods.
- Use `IEnumerable<T>` for collections that are not modified.
- Never return mutable collections from public APIs.
- Don't use regions in the code.
- Never add postfixes like Async, Impl, etc. to class or method names.
- Favor collection initializers and object initializers.
- Use string interpolation instead of string.Format or concatenation.
- Favor primary constructors for all types.

## TypeScript / Frontend Instructions

- Prefer `const` over `let` over `var` when declaring variables.
- Never use shortened or abbreviated names for variables, parameters, or properties.
  - Use full descriptive names: `deltaX` not `dx`, `index` not `idx`, `event` not `e`, `previous` not `prev`, `direction` not `dir`, `position` not `pos`, `contextMenu` not `ctx`/`ctxMenu`.
  - The only acceptable short names are well-established domain terms (e.g. `id`, `url`, `min`, `max`).
- Never leave unused import statements in the code.
- Always ensure that the code compiles without warnings.
  - Use `yarn compile` to verify (if successful it doesn't output anything).
- Do not prefix a file, component, type, or symbol with the name of its containing folder or the concept it belongs to. Instead, use folder structure to provide that context.
- Favor functional folder structure over technical folder structure.
  - Group files by the feature or concept they belong to, not by their technical role.
  - Avoid folders like `components/`, `hooks/`, `utils/`, `types/` at the feature level.

## Exceptions

- Use exceptions for exceptional situations only.
- Don't use exceptions for control flow.
- Always provide a meaningful message when throwing an exception.
- Always create a custom exception type that derives from Exception.
- Never use any built-in exception types like InvalidOperationException, ArgumentException, etc.
- Add XML documentation for exceptions being thrown.
- XML documentation for exception should start with "The exception that is thrown when ...".
- Never suffix exception class names with "Exception".

## Nullable Reference Types

- Always use is null or is not null instead of == null or != null.
- Trust the C# null annotations and don't add null checks when the type system says a value cannot be null.
- Add `!` operator where nullability warnings occur.
- Use `is not null` checks before dereferencing potentially null values.

## Naming Conventions

- Follow PascalCase for component names, method names, and public members.
- Use camelCase for private fields and local variables.
- Prefix private fields with an underscore (e.g., `_privateField`).
- Prefix interface names with "I" (e.g., IUserService).

## Logging

- Use structured logging with named parameters.
- Use appropriate log levels (Information, Warning, Error, Debug).
- Always use a generic ILogger<T> where T is the class name.
- Keep logging in separate partial methods for better readability. Call the file `<SystemName>Logging.cs`. Make this class partial and static and internal and all methods should be internal.
- Use the `[LoggerMessage]` attribute to define log messages.
- Don't include `eventId` in the `[LoggerMessage]` attribute.

## Dependency Injection

- Systems that have a convention of IFoo to Foo does not need to be registered explicitly.
- Prefer constructor injection over method injection.
- Avoid service locator pattern (i.e., avoid using IServiceProvider directly).
- For implementations that should be singletons, use the `[Singleton]` attribute on the class.

## TypeScript Type Safety

- Never use `any` type - always use proper type annotations:
  - Use `unknown` for values of unknown type that need runtime checking.
  - Use `Record<string, unknown>` for objects with unknown properties.
  - Use proper generic constraints like `<TCommand extends object = object>` instead of `= any`.
  - Use `React.ComponentType<Props>` for React component types.
- When type assertions are necessary, use `unknown` as an intermediate type:
  - Prefer `value as unknown as TargetType` over `value as any`.
  - For objects with dynamic properties: `(obj as unknown as { prop: Type }).prop`.
- For generic React components:
  - Use `unknown` as default generic parameter instead of `any`.
  - Example: `<TCommand = unknown>` not `<TCommand = any>`.
- For event handlers:
  - Be careful with React.MouseEvent vs DOM MouseEvent - they are different types.
  - React synthetic events: `React.MouseEvent<Element, MouseEvent>`.
  - DOM native events: `MouseEvent`.
  - Convert between them using: `nativeEvent as unknown as React.MouseEvent`.
  - Use `e.preventDefault?.()` instead of `(e as any).preventDefault?.()`.

## Testing

- Follow the following guides:
   - [C# specifics](./instructions/csharp.instructions.md)
   - [How to Write Specs](./instructions/specs.instructions.md)
   - [How to Write C# Specs](./instructions/specs.csharp.instructions.md)
   - [How to Write TypeScript Specs](./instructions/specs.typescript.instructions.md)
   - [How to Write Entity Framework Core Specs](./instructions/efcore.specs.instructions.md)
   - [Concepts](./instructions/concepts.instructions.md)
   - [Documentation](./instructions/documentation.instructions.md)
   - [Pull Requests](./instructions/pull-requests.instructions.md)
   - [Vertical Slices](./instructions/vertical-slices.instructions.md)
   - [TypeScript Conventions](./instructions/typescript.instructions.md)
   - [React Components](./instructions/components.instructions.md)

## Header

All files should start with the following header:

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
```
