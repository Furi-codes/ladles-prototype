/* eslint-disable @typescript-eslint/no-require-imports -- Isolated webpack preview loader. */
const path=require('node:path');
const ts=require('typescript');
const base=require('./system-loader.cjs');
module.exports=function(source){
  const file=this.resourcePath.replaceAll('\\','/'),runtime=JSON.stringify(path.join(__dirname,'corporate-review-runtime.jsx'));
  if(file.endsWith('/lib/supabase.ts'))return `const r=require(${runtime});exports.supabase=r.supabase;exports.getCurrentUser=async()=>r.currentUser();`;
  if(file.endsWith('/lib/feature-flags.ts'))return 'exports.corporateRolloutEnabled=true;exports.corporateBookingsEnabled=true;exports.corporateChangesEnabled=true;exports.corporateOutcomesEnabled=true;';
  if(file.endsWith('/components/AdminProvider.tsx'))return `const r=require(${runtime});exports.useAdminData=r.useAdminData;exports.AdminProvider=({children})=>children;`;
  if(file.endsWith('/components/ThemeProvider.tsx'))source=source.replaceAll('ladles-theme','ladles-corporate-review-theme');
  if(file.endsWith('.css'))return base.call(this,source);
  return ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
};
