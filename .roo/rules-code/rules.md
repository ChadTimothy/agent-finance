## Core Engineering Principles

##Never forget these 3 Rules
DO NOT simulate code, tests, functions, dependancies etc. We are building a real app here not a simulation!! Avoid unit tests, do not be lazy, always fix underlying issue rather than modifying tests unless the test has the error.
DO NOT use mocks, (testing) stubs or fake code, if you find these in the code or test files remove and replace with real tests, testing real components with real keys,variables,apis, data .... We are building a real app here not a fake or mock app!! 
WE ARE building a real app here, all generated code must be production ready, after being completed and tested. Our app is for users, users cannot use an app that is not built for production!!

### Simplicity and Clarity
**KISS (Keep It Simple, Stupid), DRY and other best practices**: Always prefer simple solutions without trading functionality. Over-engineering is a liability. Do No Repeat yourself, keep the codebase easily manageable.

**Stick to Implemtation Plan**: The implementation plans can be found in /dev_docs/implementation/ - Keep these up to date, never modify the input or outputs as other services may rely on what we have previously decided on - if these will not work explicitly ask me to change

**Clean Code**: Keep the codebase clean and organized. Code must be maintainable enough that a junior developer could easily understand and modify it. Document code heavily with references to other relevant parts of the codebase.

**Install Dependancies**: Always install dependancies if required in the milestones or tasks, whenever generating code that uses a dependancy search for documentation or the dependancy code to reduce errors. NEVER SIMULATE DEPENDANCIES

**Modular Design**: Implement modular design principles to improve code maintainability and reusability.

**Directory Structure**: Keep an up to date file called /dev_docs/directory_structure.md with the directory structure of the app and refer to this when looking for the correct file to edit

**Refactoring Thresholds**: 
- Avoid files over 200-300 lines of code. Refactor at that point into multiple files.
- When a function becomes too long, split it into smaller functions.
- Make sure to inspect how the files are currently being used to ensure the new split does not affect the functionality of the code.

**Scripts**: Avoid writing scripts in files if possible, especially if the script is likely only to be run once.

### Development Process
**Research First**: Always check documentation and the existing codebase when writing code or building tests. Understand the entire context of how your code fits with the overall project. Do not make assumptions or speculate without clear evidence.

**Preserving and Changing Existing Code**: Don't remove unrelated code or functionalities. Pay attention to preserving existing structures. Only make changes that are requested or you are confident are well understood and related to the change being requested when working on existing code.

**New Technology Patterns**: When generating code, fixing a bug or managing testing, DO NOT introduce a new pattern of technology without first exhausting all options for the existing implementation. If you do introduce a new pattern, remove the old implementation to avoid duplicate logic.

**File-by-File Changes**: Make changes file by file to allow for proper review.

**Single Chunk Edits**: Provide all edits in a single chunk instead of multiple-step instructions or explanations for the same file.

**Check Context**: Remember to check the context for current file contents and implementations. Refer to past conversation.

**No Whitespace Suggestions**: Don't suggest whitespace changes unless specifically requested.

**No Inventions**: Don't invent changes other than what's explicitly requested, stick closely to the project requirements and always prioritise production readiness.

**No Unnecessary Confirmations**: Don't ask for confirmation of information already provided in the context.

**No Implementation Checks**: Don't ask to verify implementations that are visible in the provided context.

**No Unnecessary Updates**: Don't suggest updates or changes to files when there are no actual modifications needed.

**Finding Errors**: When analyzing errors, write three distinct reasoning paragraphs to explore possible causes before proposing a solution. Avoid premature conclusions.


### Security and Compatibility
**Security-First Approach**: Always consider security implications when modifying or suggesting code changes.

**Version Compatibility**: Ensure suggested changes are compatible with the project's specified language or framework versions.

**Production Ready**: At the completion of the task, the code must be production ready, meaning it is ready and tested for the user to use without further modification.

## Code Quality Standards

### Naming and Style
**Descriptive Naming**: Use explicit, descriptive variable and function names over short, ambiguous ones to enhance code readability.

**Follow Consistent Coding Style**: Adhere to the existing coding style in the project for consistency.

**Avoid Magic Numbers**: Replace hardcoded values with named constants to improve code clarity and maintainability.

### Robustness and Performance
**Consider Edge Cases**: When implementing logic, always consider and handle potential edge cases.

**Use Assertions**: Include assertions wherever possible to validate assumptions and catch potential errors early.

### Engineering Excellence
**Senior Developer Mindset**: Approach tasks with the expertise, foresight, and efficiency of a senior developer, prioritizing best practices and robust solutions.

**Always Complete Features**: Continue working on a feature until it is fully implemented and functional, without leaving it incomplete.

**Short Functions**: Write short functions with a single purpose, ideally less than 20 instructions.

**Single Level of Abstraction**: Use a single level of abstraction within functions.

**Schemas First**: Define data models in schemas first, never leave schemas undocumented, never skip schema validation.

**Checking off tasks**: When reading tasks or implementation plans from a file, ensure that you check off items that have been completed

**Avoid Nesting Blocks**: Reduce complexity by:
- Using early checks and returns
- Extracting to utility functions
- Using higher-order functions (map, filter, reduce)
- Using arrow functions for simple operations
- Using named functions for complex operations
- Using default parameter values
- Using objects for multiple parameters (RO-RO pattern)
- Declaring necessary types for inputs and outputs

**Preserve Comments**: Retain all existing comments in code, even when modifying or refactoring, as long as they match the current code.

## Security Best Practices

**Secret Management**:
- Never commit secrets to the repository
- Use environment variables for secrets
- Consider using a secret management service for production

## Environment Management

**Environment Consistency**: Always run an environment the same as the production environment, this may mean running a docker container with live code updates, running a server, running an app or a 3rd party service while producing code and testing code. Decide on a project by project basis and keep a file called /dev_docs/test_environment.md that contains up to date information on running the service for testing.

**Configuration Management**: Use environment variables for configuration and secrets. Never hardcode environment-specific values.

**Build Artifacts**: Ensure build artifacts are not committed to the repository. Add build directories to `.gitignore`.
