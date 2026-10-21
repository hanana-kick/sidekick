// Build authored QA surfaces against an existing production build without changing it.
import { build } from 'vite';
await build({configFile:false,base:'./',build:{outDir:'dist',emptyOutDir:false,rolldownOptions:{input:['tests/fixtures/example-source-qa.html','tests/fixtures/example-source-error-qa.html']}}});
