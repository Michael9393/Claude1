---
name: new-component
description: Scaffolds a new React component and its colocated test, following the project conventions. Use when adding a new component or page.
argument-hint: <ComponentName> [components|pages]
---

# /new-component

Arguments: `$ARGUMENTS`. The first argument is the component name. The second is the folder, `components` (the default) or `pages`.

1. **Validate the name.** It must be PascalCase (`^[A-Z][A-Za-z0-9]*$`). If it isn't, suggest a corrected name and stop. Check that `src/<folder>/<Name>.tsx` doesn't already exist, and stop if it does.
2. **Create `src/<folder>/<Name>.tsx`:**

   ```tsx
   function <Name>() {
     return <div><Name></div>
   }

   export default <Name>
   ```

   If the user described what the component does, write real markup instead of the placeholder. Add a typed `type <Name>Props = { ... }` for its props, and never use an empty `{}` props pattern, which oxlint flags. Use semantic HTML (for example `<section>`, `<button>`, `<ul>`). For a page, use `<main>` with an `<h1>`.

3. **Create `src/<folder>/<Name>.test.tsx`:**

   ```tsx
   import { render, screen } from '@testing-library/react'
   import { describe, expect, it } from 'vitest'
   import <Name> from './<Name>.tsx'

   describe('<Name>', () => {
     it('renders', () => {
       render(<<Name> />)
       expect(screen.getByText('<Name>')).toBeInTheDocument()
     })
   })
   ```

   Keep the test's query in line with the markup you actually wrote. Prefer `getByRole` when there is a heading or a button.

4. If the folder still contains a `.gitkeep`, delete it.
5. Run `npx vitest run src/<folder>/<Name>.test.tsx` and `npm run typecheck`. Then report the files you created and the test result.
