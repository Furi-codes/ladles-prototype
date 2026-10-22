/* eslint-disable @typescript-eslint/no-require-imports -- Node/webpack build entry intentionally uses CommonJS. */
/* Build the offline UI snapshot. Existing snapshot files are never overwritten. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bundled = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '..');
const snapshot = path.join(__dirname, 'system-source');
function capture(directory) {
  for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes:true })) {
    const relative = path.join(directory,item.name);
    if (item.isDirectory()) { if (!['api','.next','node_modules'].includes(item.name)) capture(relative); }
    else if (/\.(tsx?|css)$/.test(item.name)) {
      const target = path.join(snapshot,relative);
      if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target); }
    }
  }
}
capture('app');capture('lib');
const manifest=[];
function inventory(directory) {for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())inventory(file);else manifest.push({file:path.relative(snapshot,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}}
inventory(snapshot);
fs.writeFileSync(path.join(__dirname,'system-source-manifest.json'),JSON.stringify({description:'Frozen UI source, not a live application. Edit these copies for preview UI changes.',files:manifest},null,2));
function config(node=false) {return {
  mode:'development',devtool:false,target:node?'node':'web',
  entry:path.join(__dirname,node?'system-preview.inspect.jsx':'system-preview.jsx'),
  output:{path:__dirname,filename:node?'system-preview.inspect.cjs':'system-preview.bundle.js',...(node?{library:{type:'commonjs2'}}:{})},
  resolve:{extensions:['.tsx','.ts','.jsx','.js','.json'],alias:{'@':snapshot,'next/navigation':path.join(__dirname,'system-runtime.jsx'),'next/link':path.join(__dirname,'system-link.jsx'),'next/image':path.join(__dirname,'system-image.jsx')}},
  module:{rules:[{test:/\.(tsx?|jsx|css)$/,exclude:/node_modules/,use:[path.join(__dirname,'system-loader.cjs')]}]},
  optimization:{minimize:false},performance:{hints:false},
  plugins:[new bundled.webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production')}),new bundled.webpack.BannerPlugin({banner:'/* eslint-disable -- Generated offline preview bundle; lint its source files instead. */',raw:true})],
};}
bundled.webpack([config(),config(true)],(error,stats)=>{
  if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
  const report=stats.toJson({all:false,children:true,modules:true});
  const serialized=JSON.stringify(report);
  if(/node_modules[\\/]+@supabase[\\/]+|node_modules[\\/]+@zxing[\\/]+/.test(serialized)){console.error('Unsafe dependency entered the preview bundle.');process.exitCode=1;return;}
  console.log('Offline system preview built. Snapshot files preserved. No live credentials or database clients included.');
});
