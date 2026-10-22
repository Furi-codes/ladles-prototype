/* eslint-disable @typescript-eslint/no-require-imports -- Webpack loaders run as CommonJS Node modules. */
const ts=require('typescript');
const path=require('node:path');
const crypto=require('node:crypto');
module.exports=function(source){
  const file=this.resourcePath.replaceAll('\\','/');
  const runtime=JSON.stringify(path.join(__dirname,'system-runtime.jsx'));
  if(file.endsWith('.css')){
    if(file.endsWith('/globals.css'))source=source.replace(/@import[^;]+;/g,'').replace(/@theme inline\s*\{[^}]*\}/g,'');
    let classes={};
    if(file.endsWith('.module.css')){
      const prefix='p'+crypto.createHash('sha1').update(file.split('/system-source/')[1]||file).digest('hex').slice(0,7)+'_';
      const globals=[];source=source.replace(/:global\(([^)]+)\)/g,(_,s)=>{globals.push(s);return 'GLOBALTOKEN'+(globals.length-1);});
      source=source.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>{classes[name]=prefix+name;return '.'+prefix+name;});
      source=source.replace(/GLOBALTOKEN(\d+)/g,(_,i)=>globals[Number(i)]);
    }
    return `if(typeof document!=='undefined'){const s=document.createElement('style');s.textContent=${JSON.stringify(source)};document.head.appendChild(s);}module.exports=${JSON.stringify(classes)};`;
  }
  if(file.includes('/system-source/lib/actions/')){
    const names=[...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
    return `const r=require(${runtime});`+names.map(name=>`exports.${name}=Object.assign(function ${name}(...a){return r.action(${JSON.stringify(name)},...a)},{previewName:${JSON.stringify(name)}});`).join('\n');
  }
  if(file.endsWith('/system-source/lib/supabase.ts'))return `const r=require(${runtime});exports.supabase=r.supabase;exports.getCurrentUser=async()=>r.currentUser();`;
  if(file.endsWith('/components/AdminProvider.tsx'))return `const r=require(${runtime});exports.useAdminData=r.useAdminData;exports.AdminProvider=r.PreviewProvider;`;
  if(file.endsWith('/components/VolunteerProvider.tsx'))return `const r=require(${runtime});exports.useVolunteerData=r.useVolunteerData;exports.VolunteerProvider=r.PreviewProvider;exports.CONSENT_VERSION='2026-09-14';`;
  if(file.endsWith('/components/FeatureShared.tsx'))return `const r=require(${runtime});exports.useFeatureData=r.useFeatureData;exports.Field=r.Field;exports.FeatureState=r.FeatureState;`;
  if(file.endsWith('/components/useProfilePhotoUrl.ts'))return `exports.useProfilePhotoUrl=()=>null;`;
  if(file.endsWith('/components/ThemeProvider.tsx'))source=source.replaceAll('ladles-theme','ladles-preview-theme');
  if(file.endsWith('/components/AttendanceScanner.tsx'))return `module.exports=require(${runtime}).DemoScanner;`;
  return ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
};
